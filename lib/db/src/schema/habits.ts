import { pgTable, text, serial, timestamp, date, unique, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const habitsTable = pgTable("habits", {
  id: serial("id").primaryKey(),
  walletId: text("wallet_id").notNull().default("default"),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("star"),
  targetDays: text("target_days").array().notNull().default(["all"]),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderTimes: text("reminder_times").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  archivedAt: timestamp("archived_at"),
}, (t) => ({
  byWallet: index("habits_wallet_idx").on(t.walletId),
}));

export const REMINDER_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const insertHabitSchema = createInsertSchema(habitsTable).omit({ id: true, createdAt: true });
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type Habit = typeof habitsTable.$inferSelect;

export const habitCompletionsTable = pgTable(
  "habit_completions",
  {
    id: serial("id").primaryKey(),
    habitId: serial("habit_id").references(() => habitsTable.id, { onDelete: "cascade" }).notNull(),
    completedDate: date("completed_date").notNull(),
    mood: text("mood"),
    note: text("note"),
  },
  (t) => ({
    uniqHabitDate: unique("uniq_habit_date").on(t.habitId, t.completedDate),
  })
);

export const HABIT_MOODS = ["great", "good", "okay", "meh", "bad"] as const;
export type HabitMood = (typeof HABIT_MOODS)[number];
export const NOTE_MAX_LENGTH = 280;

export const insertHabitCompletionSchema = createInsertSchema(habitCompletionsTable).omit({ id: true });
export type InsertHabitCompletion = z.infer<typeof insertHabitCompletionSchema>;
export type HabitCompletion = typeof habitCompletionsTable.$inferSelect;
