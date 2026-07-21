import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

/**
 * AdMob integration for Habiganize mobile.
 *
 * Step 1 — SDK setup: {@link https://developers.google.com/admob/android/quick-start}
 * Step 2 — Rewarded ads (load → show → earn reward): {@link https://developers.google.com/admob/android/rewarded}
 *
 * Android test rewarded unit (use while developing): ca-app-pub-3940256099942544/5224354917
 */

const DEV_PLACEHOLDER_MS = 4200;
const REWARDED_LOAD_TIMEOUT_MS = 25_000;
/** Google recommends refreshing preloaded ads about every hour. */
const REWARDED_MAX_AGE_MS = 55 * 60 * 1000;

export type ShowRewardedAdResult = "earned" | "dismissed" | "error" | "unavailable";

export function rewardedAdUnitId(): string {
  const fromEnv = process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID?.trim();
  if (fromEnv) return fromEnv;
  return TestIds.REWARDED;
}

let initPromise: Promise<void> | null = null;

let cachedRewarded: RewardedAd | null = null;
let cachedLoadedAt: number | null = null;
let preloadPromise: Promise<boolean> | null = null;

function isCacheFresh(): boolean {
  if (!cachedRewarded || cachedLoadedAt == null) return false;
  return Date.now() - cachedLoadedAt < REWARDED_MAX_AGE_MS;
}

function clearCache(): void {
  cachedRewarded = null;
  cachedLoadedAt = null;
}

/**
 * Step 1 — Initialize Google Mobile Ads SDK once at app launch.
 */
export function initializeAdMob(): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  if (!initPromise) {
    initPromise = mobileAds()
      .initialize()
      .then(() => {
        void preloadRewardedAd();
      })
      .catch(() => {
        initPromise = null;
      });
  }
  return initPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Step 2a — Load a rewarded ad into cache (zero latency when the user taps Watch ad).
 * Safe to call multiple times; concurrent calls share one in-flight load.
 */
export function preloadRewardedAd(): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(false);
  if (isCacheFresh()) return Promise.resolve(true);
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      await initializeAdMob();
    } catch {
      return false;
    }

    if (isCacheFresh()) return true;

    clearCache();

    return new Promise<boolean>((resolve) => {
      const rewarded = RewardedAd.createForAdRequest(rewardedAdUnitId());
      const unsubs: Array<() => void> = [];
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        for (const u of unsubs) u();
        preloadPromise = null;
        resolve(ok);
      };

      unsubs.push(
        rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          cachedRewarded = rewarded;
          cachedLoadedAt = Date.now();
          finish(true);
        }),
      );
      unsubs.push(
        rewarded.addAdEventListener(AdEventType.ERROR, () => {
          clearCache();
          finish(false);
        }),
      );

      const timeout = setTimeout(() => {
        clearCache();
        finish(false);
      }, REWARDED_LOAD_TIMEOUT_MS);
      unsubs.push(() => clearTimeout(timeout));

      rewarded.load();
    });
  })();

  return preloadPromise;
}

/** True when a rewarded ad is loaded and ready to show (step 2 — before show()). */
export function isRewardedAdReady(): boolean {
  return Platform.OS !== "web" && isCacheFresh();
}

/**
 * Step 2b–2c — Show preloaded rewarded ad; grant in-app reward only after EARNED_REWARD
 * (OnUserEarnedRewardListener). Full-screen lifecycle uses CLOSED / ERROR callbacks.
 */
export async function showRewardedAd(): Promise<ShowRewardedAdResult> {
  if (Platform.OS === "web") {
    await sleep(DEV_PLACEHOLDER_MS);
    return "earned";
  }

  try {
    await initializeAdMob();
  } catch {
    return "unavailable";
  }

  if (!isCacheFresh()) {
    const loaded = await preloadRewardedAd();
    if (!loaded || !cachedRewarded) return "error";
  }

  const rewarded = cachedRewarded!;
  clearCache();

  return new Promise((resolve) => {
    let earned = false;
    let settled = false;
    const unsubs: Array<() => void> = [];

    const finish = (result: ShowRewardedAdResult) => {
      if (settled) return;
      settled = true;
      for (const u of unsubs) u();
      resolve(result);
      void preloadRewardedAd();
    };

    // OnUserEarnedRewardListener — reward only after the user completes the placement.
    unsubs.push(
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
    );

    // FullScreenContentCallback — dismissed / failed while showing.
    unsubs.push(
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        finish(earned ? "earned" : "dismissed");
      }),
    );
    unsubs.push(
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        finish("error");
      }),
    );

    try {
      rewarded.show();
    } catch {
      finish("error");
    }
  });
}
