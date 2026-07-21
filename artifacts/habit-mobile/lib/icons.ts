export const HABIT_ICONS = [
  "sun",
  "moon",
  "star",
  "coffee",
  "droplet",
  "heart",
  "activity",
  "book",
  "music",
  "smile",
  "zap",
  "target",
  "award",
  "check-circle",
  "camera",
  "headphones",
] as const;

export type HabitIconName = (typeof HABIT_ICONS)[number];

export const DEFAULT_HABIT_ICON: HabitIconName = "star";

export function resolveHabitIcon(name: string | null | undefined): HabitIconName {
  if (name && (HABIT_ICONS as readonly string[]).includes(name)) {
    return name as HabitIconName;
  }
  return DEFAULT_HABIT_ICON;
}
