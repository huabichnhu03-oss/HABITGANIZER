import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { Habit } from "@workspace/api-client-react";

const DAY_TO_WEEKDAY: Record<string, number> = {
  sun: 1,
  mon: 2,
  tue: 3,
  wed: 4,
  thu: 5,
  fri: 6,
  sat: 7,
};

const ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function expandTargetDays(targetDays: string[] | null | undefined): string[] {
  if (!targetDays || targetDays.length === 0) return [...ALL_DAYS];
  if (targetDays.includes("all")) return [...ALL_DAYS];
  return targetDays.filter((d) => DAY_TO_WEEKDAY[d] !== undefined);
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) return null;
  return { hour: parseInt(m[1], 10), minute: parseInt(m[2], 10) };
}

export function reminderTagFor(habitId: number): string {
  return `habit-reminder-${habitId}`;
}

let handlerConfigured = false;
export function configureNotifications() {
  if (handlerConfigured) return;
  handlerConfigured = true;
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (!settings.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function cancelHabitReminders(habitId: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const tag = reminderTagFor(habitId);
    await Promise.all(
      scheduled
        .filter((n) => {
          const data = (n.content?.data ?? {}) as { tag?: string };
          return data.tag === tag;
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch {
    // best-effort
  }
}

export async function scheduleHabitReminders(habit: Habit): Promise<void> {
  if (Platform.OS === "web") return;
  await cancelHabitReminders(habit.id);
  if (!habit.reminderEnabled) return;
  const times = habit.reminderTimes ?? [];
  if (times.length === 0) return;
  const days = expandTargetDays(habit.targetDays);
  if (days.length === 0) return;
  const tag = reminderTagFor(habit.id);
  for (const time of times) {
    const parsed = parseTime(time);
    if (!parsed) continue;
    for (const day of days) {
      const weekday = DAY_TO_WEEKDAY[day];
      if (weekday === undefined) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Reminder: ${habit.name}`,
            body: `It's ${time} — time to ${habit.name.toLowerCase()}.`,
            data: { tag, habitId: habit.id, time, route: "today" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: parsed.hour,
            minute: parsed.minute,
          },
        });
      } catch {
        // Skip silently; one bad time shouldn't block the rest.
      }
    }
  }
}

export async function rescheduleAllReminders(habits: Habit[] | null | undefined): Promise<void> {
  if (Platform.OS === "web") return;
  if (!habits) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) => {
      const data = (n.content?.data ?? {}) as { tag?: string };
      return typeof data.tag === "string" && data.tag.startsWith("habit-reminder-");
    });
    await Promise.all(
      ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  } catch {
    // ignore
  }
  for (const h of habits) {
    if (h.reminderEnabled) {
      await scheduleHabitReminders(h);
    }
  }
}
