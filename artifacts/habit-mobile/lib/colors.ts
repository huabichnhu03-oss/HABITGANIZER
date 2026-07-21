import colors from "@/constants/colors";

export interface HabitSwatch {
  name: string;
  hex: string;
}

export const HABIT_SWATCHES: HabitSwatch[] = [
  { name: "Blue", hex: colors.light.blue },
  { name: "Pink", hex: colors.light.pink },
  { name: "Yellow", hex: colors.light.yellow },
  { name: "Green", hex: colors.light.green },
  { name: "White", hex: colors.light.card },
];

export const HABIT_PALETTE = HABIT_SWATCHES.map((s) => s.hex);

export function pickHabitColor(index: number): string {
  return HABIT_PALETTE[index % HABIT_PALETTE.length];
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(value: string | null | undefined): boolean {
  if (!value) return false;
  return HEX_RE.test(value.trim());
}

/** Normalize "#abc" -> "#aabbcc"; lowercase. Returns null if invalid. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!HEX_RE.test(v)) return null;
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v;
}

/**
 * Returns the stored hex if valid (any color, not just the 5 swatches),
 * otherwise falls back to a deterministic palette swatch.
 */
export function resolveHabitColor(
  storedColor: string | null | undefined,
  fallbackIndex: number,
): string {
  const normalized = normalizeHex(storedColor);
  if (normalized) return normalized;
  return pickHabitColor(fallbackIndex);
}

/**
 * WCAG-style relative luminance picker for legible foreground text.
 */
export function getReadableForeground(hex: string | null | undefined): string {
  const normalized = normalizeHex(hex);
  if (!normalized) return "#141414";
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // WCAG crossover: pick the foreground with higher contrast vs bg.
  // Black wins when L > sqrt(1.05*0.05) - 0.05 ≈ 0.179.
  return L > 0.179 ? "#141414" : "#ffffff";
}

import { localCalendarDateString } from "@workspace/habit-dates";

export function todayString(): string {
  return localCalendarDateString();
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function todayWeekdayKey(d: Date = new Date()): string {
  return WEEKDAY_KEYS[d.getDay()];
}

export function isHabitActiveToday(targetDays: string[], d: Date = new Date()): boolean {
  if (!targetDays || targetDays.length === 0) return true;
  if (targetDays.includes("all")) return true;
  return targetDays.includes(todayWeekdayKey(d));
}

export function formatPrettyDate(d: Date = new Date()): string {
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}
