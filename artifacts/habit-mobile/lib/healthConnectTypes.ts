import type { HealthMetric } from "@workspace/api-client-react";

export type HealthPhoneSyncResult =
  | {
      ok: true;
      updated: Partial<Record<HealthMetric, number>>;
      message: string;
    }
  | {
      ok: false;
      code:
        | "unsupported_platform"
        | "sdk_unavailable"
        | "init_failed"
        | "no_data"
        | "permission_denied"
        | "api_error"
        | "unknown";
      message?: string;
    };
