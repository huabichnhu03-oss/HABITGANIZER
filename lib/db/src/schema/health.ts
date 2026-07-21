import { pgTable, text, integer, serial, timestamp, date, real, unique, index } from "drizzle-orm/pg-core";
import { walletsTable } from "./rewards";

export const HEALTH_METRICS = ["steps", "kcal", "sleep", "standups", "heart_rate"] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const healthEntriesTable = pgTable(
  "health_entries",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    entryDate: date("entry_date").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    byWalletDate: index("health_entries_wallet_date_idx").on(t.walletId, t.entryDate),
    byWalletMetricDate: index("health_entries_wallet_metric_date_idx").on(t.walletId, t.metric, t.entryDate),
  })
);
export type HealthEntry = typeof healthEntriesTable.$inferSelect;

export const healthGoalsTable = pgTable(
  "health_goals",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
    metric: text("metric").notNull(),
    goal: real("goal").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqWalletMetric: unique("uniq_health_goal_wallet_metric").on(t.walletId, t.metric),
  })
);
export type HealthGoal = typeof healthGoalsTable.$inferSelect;
