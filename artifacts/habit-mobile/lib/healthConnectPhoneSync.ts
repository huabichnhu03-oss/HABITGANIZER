import type { HealthMetric } from "@workspace/api-client-react";

import type { HealthPhoneSyncResult } from "./healthConnectTypes";

export type { HealthPhoneSyncResult } from "./healthConnectTypes";

/** iOS / Web — Health Connect is Android-only. */
export async function syncHealthFromPhone(_args: {
  getTodayEntryIds: (metric: HealthMetric) => number[];
}): Promise<HealthPhoneSyncResult> {
  return { ok: false, code: "unsupported_platform" };
}
