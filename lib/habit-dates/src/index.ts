/**
 * Habit completion rows use a civil calendar YYYY-MM-DD (user-local intent).
 * Clients send this header so the API can match "today" and streaks to the same zone.
 */
export const HABIT_CALENDAR_TZ_HEADER = "X-Habit-Calendar-Timezone";

const TZ_HEADER_RE = /^[A-Za-z0-9_/+\-]+$/;

/** YYYY-MM-DD in the device's local timezone (wall clock). */
export function localCalendarDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** IANA zone from the runtime, or UTC if unavailable. */
export function resolvedIanaTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === "string" && tz.length > 0 && TZ_HEADER_RE.test(tz)) return tz;
  } catch {
    // ignore
  }
  return "UTC";
}

/** Extra headers for habit API calls (calendar "today" alignment). */
export function habitCalendarRequestHeaders(): Record<string, string> {
  return { [HABIT_CALENDAR_TZ_HEADER]: resolvedIanaTimeZone() };
}

/** YYYY-MM-DD for `d` interpreted in `ianaTimeZone`. */
export function calendarDateInTimeZone(d: Date, ianaTimeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: ianaTimeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function utcCalendarDateString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Normalize client-provided IANA timezone. Returns null if missing/invalid.
 */
export function normalizeCalendarTimeZoneHeader(raw: string | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > 120 || !TZ_HEADER_RE.test(t)) return null;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: t }).format(new Date());
    return t;
  } catch {
    return null;
  }
}

/** Add integer days to a YYYY-MM-DD civil date (UTC date math on calendar components). */
export function addCalendarDays(ymd: string, deltaDays: number): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd);
  if (!m) return ymd;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const utcMs = Date.UTC(y, mo - 1, d + deltaDays);
  const dt = new Date(utcMs);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
