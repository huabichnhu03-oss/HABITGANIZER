/**
 * Ultra-compact countdown (matches mobile). “~” ≈ roughly; digits stick to h/m/s/d units
 * so they don’t read like “million” (e.g. ~5h32m).
 */
export function formatWaitRemaining(ms: number): string {
  const safeMs = Math.max(0, ms);
  if (safeMs <= 2_500) return "Soon";
  if (safeMs < 60_000) return `~${Math.max(1, Math.ceil(safeMs / 1000))}s`;

  const totalMin = Math.max(1, Math.ceil(safeMs / 60_000));
  const daysRounded = Math.max(1, Math.round(totalMin / (60 * 24)));

  if (totalMin >= 72 * 60) {
    return daysRounded === 1 ? "~1d" : `~${daysRounded}d`;
  }

  if (totalMin < 60) return `~${totalMin}m`;

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;

  if (m === 0) return `~${h}h`;
  return `~${h}h${m}m`;
}

/** Spoken-length label for accessibility (compact UI uses {@link formatWaitRemaining}). */
export function formatWaitRemainingA11y(ms: number): string {
  const safeMs = Math.max(0, ms);
  if (safeMs <= 2_500) return "Almost ready";
  if (safeMs < 60_000) return `Roughly ${Math.max(1, Math.ceil(safeMs / 1000))} seconds until play`;

  const totalMin = Math.max(1, Math.ceil(safeMs / 60_000));
  const daysRounded = Math.max(1, Math.round(totalMin / (60 * 24)));
  if (totalMin >= 72 * 60) {
    return daysRounded === 1 ? "About one day until play" : `About ${daysRounded} days until play`;
  }
  if (totalMin < 60) return `${totalMin} ${totalMin === 1 ? "minute" : "minutes"} until play`;

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} ${h === 1 ? "hour" : "hours"} until play`;
  return `${h} ${h === 1 ? "hour" : "hours"} and ${m} ${m === 1 ? "minute" : "minutes"} until play`;
}
