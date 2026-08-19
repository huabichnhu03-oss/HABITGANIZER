/** Status / fun-fact key suffixes for server wake screen. */
export const SERVER_WAKE_STATUS_KEYS = [
  "serverWake.status0",
  "serverWake.status1",
  "serverWake.status2",
  "serverWake.status3",
  "serverWake.status4",
  "serverWake.status5",
] as const;

export const SERVER_WAKE_FACT_KEYS = [
  "serverWake.fact0",
  "serverWake.fact1",
  "serverWake.fact2",
  "serverWake.fact3",
  "serverWake.fact4",
  "serverWake.fact5",
  "serverWake.fact6",
  "serverWake.fact7",
  "serverWake.fact8",
  "serverWake.fact9",
  "serverWake.fact10",
  "serverWake.fact11",
  "serverWake.fact12",
  "serverWake.fact13",
  "serverWake.fact14",
  "serverWake.fact15",
  "serverWake.fact16",
  "serverWake.fact17",
  "serverWake.fact18",
  "serverWake.fact19",
] as const;

export function pickRandomIndex(length: number, exclude?: number): number {
  if (length <= 1) return 0;
  let next = Math.floor(Math.random() * length);
  if (exclude !== undefined && length > 1) {
    let guard = 0;
    while (next === exclude && guard++ < 8) {
      next = Math.floor(Math.random() * length);
    }
  }
  return next;
}
