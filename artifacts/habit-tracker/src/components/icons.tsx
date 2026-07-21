import React from "react";
import * as LucideIcons from "lucide-react";

interface DynamicIconProps extends LucideIcons.LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const formattedName = name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const IconComponent = (LucideIcons as any)[formattedName] || LucideIcons.Circle;

  return <IconComponent {...props} />;
}

export const HABIT_ICONS = [
  "sun", "moon", "star", "coffee", "droplet", "heart", "activity", "book", 
  "pen-tool", "music", "smile", "zap", "flame", "target", "award", "check-circle",
  "camera", "bike", "dumb-bell", "headphones"
];

// The 5 canonical brutalist swatches. `hex` is what we persist; `tailwind`
// is what we apply to backgrounds in the UI.
export const HABIT_BRUTAL_COLORS = [
  { name: "Blue",   hex: "#4258d6", tailwind: "bg-primary",      border: "border-primary" },
  { name: "Pink",   hex: "#f5b8c8", tailwind: "bg-secondary",    border: "border-secondary" },
  { name: "Yellow", hex: "#f8d52a", tailwind: "bg-accent",       border: "border-accent" },
  { name: "Green",  hex: "#7fc66c", tailwind: "bg-[#7fc66c]",    border: "border-[#7fc66c]" },
  { name: "White",  hex: "#ffffff", tailwind: "bg-white",        border: "border-border" },
] as const;

export type HabitBrutalColor = {
  name: string;
  hex: string;
  tailwind: string;
  border: string;
};

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
 * Resolve a habit's display color. If the stored color matches one of the
 * canonical brutalist swatches, returns that swatch (with tailwind classes).
 * If it's any other valid hex, returns a synthetic entry with empty tailwind
 * classes — call sites should rely on inline `style={{ backgroundColor }}`
 * (which they already do).
 */
export function getHabitColor(
  habit: { color?: string | null } | null | undefined,
  fallbackIndex: number,
): HabitBrutalColor {
  const stored = normalizeHex(habit?.color);
  if (stored) {
    const found = HABIT_BRUTAL_COLORS.find(c => c.hex.toLowerCase() === stored);
    if (found) return found;
    return { name: "Custom", hex: stored, tailwind: "", border: "border-border" };
  }
  return HABIT_BRUTAL_COLORS[fallbackIndex % HABIT_BRUTAL_COLORS.length];
}

/**
 * WCAG-style relative luminance. Returns "#141414" (foreground dark) or
 * "#ffffff" depending on the background's luminance, so text on top is
 * always legible.
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
  // Threshold tuned so brand swatches (yellow, pink, green, white) keep dark
  // text and only genuinely dark colors flip to white.
  // WCAG crossover: pick the foreground with higher contrast vs bg.
  // Black wins when L > sqrt(1.05*0.05) - 0.05 ≈ 0.179.
  return L > 0.179 ? "#141414" : "#ffffff";
}
