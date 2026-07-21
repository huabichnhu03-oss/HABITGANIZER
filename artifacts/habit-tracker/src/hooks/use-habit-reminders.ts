import { useEffect, useRef } from "react";
import { useListHabits, type Habit } from "@workspace/api-client-react";
import { localCalendarDateString } from "@workspace/habit-dates";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function isScheduledToday(targetDays: string[] | null | undefined): boolean {
  if (!targetDays || targetDays.length === 0) return true;
  if (targetDays.includes("all")) return true;
  const today = DAY_KEYS[new Date().getDay()];
  return targetDays.includes(today);
}

function todayKey(): string {
  return localCalendarDateString();
}

function fireNotification(habit: Habit, time: string) {
  const title = `Reminder: ${habit.name}`;
  const body = `It's ${time} — time to ${habit.name.toLowerCase()}.`;
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, tag: `habit-${habit.id}-${todayKey()}-${time}` });
      return;
    } catch {
      // fall through to in-app toast
    }
  }
  window.dispatchEvent(
    new CustomEvent("habit-reminder", { detail: { habit, time, title, body } }),
  );
}

export function useHabitReminders() {
  const { data: habits } = useListHabits();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!habits || habits.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const nowKey = `${hh}:${mm}`;
      const dayKey = todayKey();
      for (const habit of habits) {
        if (!habit.reminderEnabled) continue;
        if (habit.completedToday) continue;
        if (!isScheduledToday(habit.targetDays)) continue;
        const times = habit.reminderTimes ?? [];
        for (const t of times) {
          if (t !== nowKey) continue;
          const key = `${habit.id}|${dayKey}|${t}`;
          if (firedRef.current.has(key)) continue;
          firedRef.current.add(key);
          fireNotification(habit, t);
        }
      }
      // Trim memory: drop any keys not from today.
      for (const key of firedRef.current) {
        if (!key.includes(`|${dayKey}|`)) firedRef.current.delete(key);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [habits]);
}
