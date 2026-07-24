import { useEffect, useState } from "react";
import { healthCheck } from "@workspace/api-client-react";

const SHOW_WAKE_AFTER_MS = 700;
const POLL_INTERVAL_MS = 2_500;

/**
 * Polls `/api/healthz` until the API answers (covers Render free-tier cold start).
 * Delays showing the wake UI briefly so a warm server never flashes the screen.
 */
export function useServerReady(enabled: boolean): {
  ready: boolean;
  showWakeScreen: boolean;
} {
  const [ready, setReady] = useState(!enabled);
  const [showWakeScreen, setShowWakeScreen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      setShowWakeScreen(false);
      return;
    }

    let cancelled = false;
    setReady(false);
    setShowWakeScreen(false);

    const showTimer = window.setTimeout(() => {
      if (!cancelled) setShowWakeScreen(true);
    }, SHOW_WAKE_AFTER_MS);

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    (async () => {
      while (!cancelled) {
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 12_000);
          try {
            await healthCheck({ signal: controller.signal });
          } finally {
            window.clearTimeout(timeout);
          }
          if (cancelled) return;
          setReady(true);
          setShowWakeScreen(false);
          return;
        } catch {
          if (cancelled) return;
          await sleep(POLL_INTERVAL_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, [enabled]);

  return { ready, showWakeScreen: enabled && showWakeScreen && !ready };
}
