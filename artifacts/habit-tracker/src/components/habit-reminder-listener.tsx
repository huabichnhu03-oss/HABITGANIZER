import { useEffect } from "react";
import { useHabitReminders } from "@/hooks/use-habit-reminders";
import { useToast } from "@/hooks/use-toast";

interface ReminderEventDetail {
  title: string;
  body: string;
}

export function HabitReminderListener() {
  useHabitReminders();
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ReminderEventDetail>).detail;
      if (!detail) return;
      toast({ title: detail.title, description: detail.body });
    };
    window.addEventListener("habit-reminder", handler as EventListener);
    return () => window.removeEventListener("habit-reminder", handler as EventListener);
  }, [toast]);

  return null;
}
