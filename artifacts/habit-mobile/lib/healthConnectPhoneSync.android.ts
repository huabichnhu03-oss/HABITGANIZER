import {
  createHealthEntry,
  deleteHealthEntry,
  type HealthMetric,
} from "@workspace/api-client-react";
import {
  aggregateRecord,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";

import type { HealthPhoneSyncResult } from "./healthConnectTypes";

export type { HealthPhoneSyncResult } from "./healthConnectTypes";

const MAX: Record<Exclude<HealthMetric, "standups">, number> = {
  steps: 200000,
  kcal: 20000,
  sleep: 24,
  heart_rate: 300,
};

const READ_PERMISSIONS = [
  { accessType: "read" as const, recordType: "Steps" as const },
  { accessType: "read" as const, recordType: "ActiveCaloriesBurned" as const },
  { accessType: "read" as const, recordType: "SleepSession" as const },
  { accessType: "read" as const, recordType: "RestingHeartRate" as const },
  { accessType: "read" as const, recordType: "HeartRate" as const },
];

function utcTodayRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  return {
    operator: "between" as const,
    startTime: start.toISOString(),
    endTime: now.toISOString(),
  };
}

/** Normalize Health Connect sleep aggregate to hours (HC uses ms; some pipelines may surface sec or hours). */
function sleepAggregateToHours(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 100_000) {
    return Math.min(24, raw / 3_600_000);
  }
  if (raw > 72) {
    return Math.min(24, raw / 3_600);
  }
  return Math.min(24, raw);
}

function clamp(metric: keyof typeof MAX, v: number): number {
  const m = MAX[metric];
  return Math.max(0, Math.min(m, v));
}

export async function syncHealthFromPhone(args: {
  getTodayEntryIds: (metric: HealthMetric) => number[];
}): Promise<HealthPhoneSyncResult> {
  const timeRangeFilter = utcTodayRange();

  try {
    const sdkStatus = await getSdkStatus();
    if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE) {
      return {
        ok: false,
        code: "sdk_unavailable",
        message: "Health Connect isn't available on this device.",
      };
    }
    if (sdkStatus === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return {
        ok: false,
        code: "sdk_unavailable",
        message: "Please update Health Connect from the Play Store, then try again.",
      };
    }

    const inited = await initialize();
    if (!inited) {
      return { ok: false, code: "init_failed", message: "Couldn't start Health Connect." };
    }

    await requestPermission(READ_PERMISSIONS);

    const [stepsAgg, kcalAgg, sleepAgg, rhrAgg, hrAgg] = await Promise.all([
      aggregateRecord({ recordType: "Steps", timeRangeFilter }).catch(() => null),
      aggregateRecord({ recordType: "ActiveCaloriesBurned", timeRangeFilter }).catch(() => null),
      aggregateRecord({ recordType: "SleepSession", timeRangeFilter }).catch(() => null),
      aggregateRecord({ recordType: "RestingHeartRate", timeRangeFilter }).catch(() => null),
      aggregateRecord({ recordType: "HeartRate", timeRangeFilter }).catch(() => null),
    ]);

    const stepsTotal = stepsAgg && "COUNT_TOTAL" in stepsAgg ? stepsAgg.COUNT_TOTAL : 0;
    const kcalTotal =
      kcalAgg && "ACTIVE_CALORIES_TOTAL" in kcalAgg ? kcalAgg.ACTIVE_CALORIES_TOTAL.inKilocalories : 0;
    const sleepRaw = sleepAgg && "SLEEP_DURATION_TOTAL" in sleepAgg ? sleepAgg.SLEEP_DURATION_TOTAL : 0;
    const sleepH = sleepAggregateToHours(sleepRaw);
    let hr =
      rhrAgg && "BPM_AVG" in rhrAgg && rhrAgg.BPM_AVG > 0
        ? rhrAgg.BPM_AVG
        : hrAgg && "BPM_AVG" in hrAgg && hrAgg.BPM_AVG > 0
          ? hrAgg.BPM_AVG
          : 0;

    const next: Partial<Record<HealthMetric, number>> = {};
    if (stepsTotal > 0) next.steps = clamp("steps", Math.round(stepsTotal));
    if (kcalTotal > 0) next.kcal = clamp("kcal", Math.round(kcalTotal * 100) / 100);
    if (sleepH > 0) next.sleep = clamp("sleep", Math.round(sleepH * 100) / 100);
    if (hr > 0) next.heart_rate = clamp("heart_rate", Math.round(hr));

    const keys = Object.keys(next) as (keyof typeof next)[];
    if (keys.length === 0) {
      return {
        ok: false,
        code: "no_data",
        message: "No health data for today in Health Connect, or permission wasn't granted.",
      };
    }

    for (const metric of keys) {
      if (metric === "standups") continue;
      const ids = args.getTodayEntryIds(metric);
      await Promise.all(ids.map((id) => deleteHealthEntry(id)));
    }

    const labels: string[] = [];
    for (const metric of keys) {
      const value = next[metric];
      if (value === undefined || metric === "standups") continue;
      await createHealthEntry({ metric, value });
      if (metric === "steps") labels.push(`${value} steps`);
      else if (metric === "kcal") labels.push(`${value} kcal`);
      else if (metric === "sleep") labels.push(`${value}h sleep`);
      else if (metric === "heart_rate") labels.push(`${value} bpm`);
    }

    return {
      ok: true,
      updated: next,
      message: `Updated from phone: ${labels.join(", ")}. (Stand-ups still manual — not in Health Connect.)`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: "unknown",
      message: msg || "Sync failed.",
    };
  }
}
