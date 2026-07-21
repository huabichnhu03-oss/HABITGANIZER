/**
 * Rewarded ads on web via Google Publisher Tag (GPT).
 *
 * AdMob does not run in the browser. Mobile keeps AdMob; this module is the web
 * equivalent (rewarded video → grant in-app reward on `rewardedSlotGranted`).
 *
 * Account setup (if you already use AdMob):
 * 1. You already have a linked AdSense account (created at AdMob signup).
 * 2. Upgrade it for your site: https://support.google.com/adsense/answer/6023158
 * 3. Create a rewarded line item / ad unit in Ad Manager or AdSense, then set
 *    `VITE_GAM_REWARDED_AD_UNIT` to that path (not your AdMob app unit IDs).
 *
 * Docs: https://developers.google.com/publisher-tag/samples/display-rewarded-ad
 * Test unit: /22639388115/rewarded_web_example
 */

const GPT_SCRIPT = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";

/** Google’s documented sample rewarded path — override with VITE_GAM_REWARDED_AD_UNIT. */
const DEFAULT_REWARDED_AD_UNIT = "/22639388115/rewarded_web_example";

const PLACEHOLDER_MS = 4200;
const PRELOAD_TIMEOUT_MS = 25_000;

export type ShowRewardedAdWebResult = "earned" | "dismissed" | "error" | "unavailable";

type PendingReady = {
  makeRewardedVisible: () => void;
};

let gptLoadPromise: Promise<boolean> | null = null;
let activeSlot: googletag.Slot | null = null;
let pendingReady: PendingReady | null = null;
let preloadPromise: Promise<boolean> | null = null;

function rewardedAdUnitPath(): string {
  const fromEnv = import.meta.env.VITE_GAM_REWARDED_AD_UNIT?.trim();
  if (fromEnv && fromEnv !== "off") return fromEnv;
  return DEFAULT_REWARDED_AD_UNIT;
}

function gptDisabled(): boolean {
  return import.meta.env.VITE_GAM_REWARDED_AD_UNIT?.trim() === "off";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForGptApi(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.googletag?.apiReady) {
      resolve(true);
      return;
    }
    window.googletag = window.googletag || { cmd: [] };
    window.googletag.cmd.push(() => resolve(true));
    window.setTimeout(() => resolve(Boolean(window.googletag?.apiReady)), 12_000);
  });
}

function loadGptScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.googletag?.apiReady) return Promise.resolve(true);
  if (gptLoadPromise) return gptLoadPromise;

  gptLoadPromise = new Promise((resolve) => {
    const finish = (ok: boolean) => {
      if (!ok) gptLoadPromise = null;
      resolve(ok);
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GPT_SCRIPT}"]`);
    if (existing) {
      void waitForGptApi().then(finish);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = GPT_SCRIPT;
    script.crossOrigin = "anonymous";
    script.onload = () => void waitForGptApi().then(finish);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });

  return gptLoadPromise;
}

function destroyActiveSlot(): void {
  pendingReady = null;
  if (activeSlot && window.googletag) {
    window.googletag.destroySlots([activeSlot]);
    activeSlot = null;
  }
}

function runGptCommand(fn: () => void): Promise<void> {
  return new Promise((resolve) => {
    window.googletag = window.googletag || { cmd: [] };
    window.googletag.cmd.push(() => {
      fn();
      resolve();
    });
  });
}

/** Step 2a — Load rewarded placement (rewardedSlotReady → cache makeRewardedVisible). */
export function preloadRewardedAdWeb(): Promise<boolean> {
  if (typeof window === "undefined" || gptDisabled()) return Promise.resolve(false);
  if (pendingReady) return Promise.resolve(true);
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const scriptOk = await loadGptScript();
    if (!scriptOk) {
      preloadPromise = null;
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        preloadPromise = null;
        resolve(ok);
      };

      const timeout = window.setTimeout(() => finish(false), PRELOAD_TIMEOUT_MS);

      void runGptCommand(() => {
        destroyActiveSlot();
        const googletag = window.googletag!;
        const slot = googletag.defineOutOfPageSlot(
          rewardedAdUnitPath(),
          googletag.enums.OutOfPageFormat.REWARDED,
        );

        if (!slot) {
          window.clearTimeout(timeout);
          finish(false);
          return;
        }

        activeSlot = slot;
        slot.addService(googletag.pubads());

        const onReady = (event: googletag.RewardedSlotReadyEvent) => {
          if (event.slot !== slot) return;
          window.clearTimeout(timeout);
          pendingReady = { makeRewardedVisible: () => event.makeRewardedVisible() };
          finish(true);
        };

        googletag.pubads().addEventListener("rewardedSlotReady", onReady);
        googletag.enableServices();
        googletag.display(slot);
      });
    });
  })();

  return preloadPromise;
}

export function isRewardedAdReadyWeb(): boolean {
  return pendingReady != null;
}

function useDevPlaceholder(): boolean {
  return import.meta.env.DEV || gptDisabled();
}

async function simulateDevPlaceholder(): Promise<ShowRewardedAdWebResult> {
  await sleep(PLACEHOLDER_MS);
  return "earned";
}

/**
 * Step 2b–2c — Show cached rewarded ad; grant only on rewardedSlotGranted.
 */
export async function showRewardedAdWeb(): Promise<ShowRewardedAdWebResult> {
  if (typeof window === "undefined") return "unavailable";
  if (gptDisabled()) return simulateDevPlaceholder();

  const scriptOk = await loadGptScript();
  if (!scriptOk) return useDevPlaceholder() ? simulateDevPlaceholder() : "unavailable";

  if (!pendingReady) {
    const loaded = await preloadRewardedAdWeb();
    if (!loaded) return useDevPlaceholder() ? simulateDevPlaceholder() : "unavailable";
  }

  if (!pendingReady) return "error";

  const ready = pendingReady;
  pendingReady = null;

  return new Promise((resolve) => {
    let earned = false;
    let settled = false;

    const finish = (result: ShowRewardedAdWebResult) => {
      if (settled) return;
      settled = true;
      destroyActiveSlot();
      resolve(result);
      void preloadRewardedAdWeb();
    };

    void runGptCommand(() => {
      const googletag = window.googletag!;

      const onGranted = (event: googletag.RewardedSlotGrantedEvent) => {
        if (event.slot !== activeSlot) return;
        earned = true;
      };

      const onClosed = (event: googletag.RewardedSlotClosedEvent) => {
        if (event.slot !== activeSlot) return;
        googletag.pubads().removeEventListener("rewardedSlotGranted", onGranted);
        googletag.pubads().removeEventListener("rewardedSlotClosed", onClosed);
        finish(earned ? "earned" : "dismissed");
      };

      googletag.pubads().addEventListener("rewardedSlotGranted", onGranted);
      googletag.pubads().addEventListener("rewardedSlotClosed", onClosed);

      try {
        ready.makeRewardedVisible();
      } catch {
        googletag.pubads().removeEventListener("rewardedSlotGranted", onGranted);
        googletag.pubads().removeEventListener("rewardedSlotClosed", onClosed);
        finish("error");
      }
    });
  });
}

/** Call once when the app shell mounts so the first Pups ad is warm. */
export function initializeRewardedAdsWeb(): void {
  if (typeof window === "undefined" || gptDisabled()) return;
  void loadGptScript().then((ok) => {
    if (ok) void preloadRewardedAdWeb();
  });
}
