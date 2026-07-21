import { Router } from "express";
import { db } from "@workspace/db";
import { healthEntriesTable, healthGoalsTable, HEALTH_METRICS, type HealthMetric } from "@workspace/db";
import { and, eq, gte, desc, inArray } from "drizzle-orm";
import {
  CreateHealthEntryBody,
  UpdateHealthEntryBody,
  UpdateHealthEntryParams,
  DeleteHealthEntryParams,
  UpdateHealthGoalsBody,
} from "@workspace/api-zod";

const router = Router();

const DEFAULT_GOALS: Record<HealthMetric, number> = {
  steps: 10000,
  kcal: 500,
  sleep: 8,
  standups: 12,
  heart_rate: 70,
};

const MAX_VALUES: Record<HealthMetric, number> = {
  steps: 200000,
  kcal: 20000,
  sleep: 24,
  standups: 24,
  heart_rate: 300,
};

function validValue(metric: HealthMetric, value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_VALUES[metric];
}

const HISTORY_DAYS = 7;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isHealthMetric(s: string): s is HealthMetric {
  return (HEALTH_METRICS as readonly string[]).includes(s);
}

function serializeEntry(row: typeof healthEntriesTable.$inferSelect) {
  return {
    id: row.id,
    metric: row.metric as HealthMetric,
    value: Number(row.value),
    entryDate: row.entryDate,
    recordedAt: (row.recordedAt instanceof Date ? row.recordedAt : new Date(row.recordedAt)).toISOString(),
  };
}

async function getGoals(walletId: string): Promise<Record<HealthMetric, number>> {
  const rows = await db.select().from(healthGoalsTable).where(eq(healthGoalsTable.walletId, walletId));
  const present = new Set(rows.map((r) => r.metric));
  const missing = HEALTH_METRICS.filter((m) => !present.has(m));
  if (missing.length > 0) {
    await db
      .insert(healthGoalsTable)
      .values(missing.map((m) => ({ walletId, metric: m, goal: DEFAULT_GOALS[m] })))
      .onConflictDoNothing();
  }
  const map: Record<HealthMetric, number> = { ...DEFAULT_GOALS };
  for (const r of rows) {
    if (isHealthMetric(r.metric)) map[r.metric] = Number(r.goal);
  }
  return map;
}

router.get("/health-metrics/summary", async (req, res) => {
  const walletId = req.walletId;
  try {
    const today = todayStr();
    const since = addDays(today, -(HISTORY_DAYS - 1));
    const goals = await getGoals(walletId);

    const rows = await db
      .select()
      .from(healthEntriesTable)
      .where(
        and(
          eq(healthEntriesTable.walletId, walletId),
          gte(healthEntriesTable.entryDate, since),
        ),
      )
      .orderBy(desc(healthEntriesTable.recordedAt));

    const metrics = HEALTH_METRICS.map((metric) => {
      const ofMetric = rows.filter((r) => r.metric === metric);
      const today_entries = ofMetric.filter((r) => r.entryDate === today).map(serializeEntry);

      const dayBuckets = new Map<string, number[]>();
      for (let i = 0; i < HISTORY_DAYS; i++) dayBuckets.set(addDays(today, -(HISTORY_DAYS - 1 - i)), []);
      for (const r of ofMetric) {
        const arr = dayBuckets.get(r.entryDate);
        if (arr) arr.push(Number(r.value));
      }

      const history = Array.from(dayBuckets.entries()).map(([date, values]) => {
        const count = values.length;
        if (count === 0) {
          return { date, value: 0, count: 0, min: null, max: null, avg: null };
        }
        const sum = values.reduce((a, b) => a + b, 0);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = sum / count;
        // Heart rate aggregates by latest reading; others by sum.
        let value: number;
        if (metric === "heart_rate") {
          // Find newest entry on that day from rows (already sorted desc by recordedAt).
          const newest = ofMetric.find((r) => r.entryDate === date);
          value = newest ? Number(newest.value) : avg;
        } else {
          value = sum;
        }
        return {
          date,
          value: round1(value),
          count,
          min: round1(min),
          max: round1(max),
          avg: round1(avg),
        };
      });

      const todayPoint = history[history.length - 1] ?? { value: 0, count: 0, min: null, max: null, avg: null };

      return {
        metric,
        goal: goals[metric],
        today: todayPoint.value,
        todayCount: todayPoint.count,
        todayMin: todayPoint.min,
        todayMax: todayPoint.max,
        todayAvg: todayPoint.avg,
        history,
        entries: today_entries,
      };
    });

    res.json({ metrics });
  } catch (err) {
    req.log.error({ err }, "Failed to load health summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/health-metrics/entries", async (req, res) => {
  const walletId = req.walletId;
  const parsed = CreateHealthEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!validValue(parsed.data.metric, parsed.data.value)) {
    res.status(400).json({ error: `Value out of range for ${parsed.data.metric}` });
    return;
  }
  try {
    const entryDate = parsed.data.entryDate
      ? (typeof parsed.data.entryDate === "string"
          ? parsed.data.entryDate
          : new Date(parsed.data.entryDate).toISOString().slice(0, 10))
      : todayStr();
    const [row] = await db
      .insert(healthEntriesTable)
      .values({
        walletId: walletId,
        metric: parsed.data.metric,
        value: parsed.data.value,
        entryDate,
      })
      .returning();
    res.status(201).json(serializeEntry(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create health entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/health-metrics/entries/:id", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = UpdateHealthEntryParams.safeParse(req.params);
  const bodyParsed = UpdateHealthEntryBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const existing = await db
      .select()
      .from(healthEntriesTable)
      .where(
        and(
          eq(healthEntriesTable.id, paramsParsed.data.id),
          eq(healthEntriesTable.walletId, walletId),
        ),
      )
      .limit(1);
    const current = existing[0];
    if (!current) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    if (!isHealthMetric(current.metric) || !validValue(current.metric, bodyParsed.data.value)) {
      res.status(400).json({ error: `Value out of range for ${current.metric}` });
      return;
    }
    const [row] = await db
      .update(healthEntriesTable)
      .set({ value: bodyParsed.data.value })
      .where(
        and(
          eq(healthEntriesTable.id, paramsParsed.data.id),
          eq(healthEntriesTable.walletId, walletId),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Entry not found" });
      return;
    }
    res.json(serializeEntry(row));
  } catch (err) {
    req.log.error({ err }, "Failed to update health entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/health-metrics/entries/:id", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = DeleteHealthEntryParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db
      .delete(healthEntriesTable)
      .where(
        and(
          eq(healthEntriesTable.id, paramsParsed.data.id),
          eq(healthEntriesTable.walletId, walletId),
        ),
      );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete health entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/health-metrics/goals", async (req, res) => {
  const walletId = req.walletId;
  const parsed = UpdateHealthGoalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    // Enforce array size limit (V24).
    if (parsed.data.goals.length > HEALTH_METRICS.length) {
      res.status(400).json({ error: "Too many goals" });
      return;
    }
    for (const g of parsed.data.goals) {
      if (!isHealthMetric(g.metric)) continue;
      if (!Number.isFinite(g.goal) || g.goal <= 0) continue;
      // Enforce upper bound (V23).
      const max = MAX_VALUES[g.metric];
      const clamped = Math.min(g.goal, max);
      await db
        .insert(healthGoalsTable)
        .values({ walletId: walletId, metric: g.metric, goal: clamped })
        .onConflictDoUpdate({
          target: [healthGoalsTable.walletId, healthGoalsTable.metric],
          set: { goal: clamped, updatedAt: new Date() },
        });
    }
    const goals = await getGoals(walletId);
    res.json(HEALTH_METRICS.map((m) => ({ metric: m, goal: goals[m] })));
  } catch (err) {
    req.log.error({ err }, "Failed to update health goals");
    res.status(500).json({ error: "Internal server error" });
  }
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export default router;
