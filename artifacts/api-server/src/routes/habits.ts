import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { habitsTable, habitCompletionsTable, HABIT_MOODS, NOTE_MAX_LENGTH } from "@workspace/db";
import { eq, and, gte, lte, lt, desc, sql, asc, isNull, isNotNull, inArray } from "drizzle-orm";
import {
  HABIT_CALENDAR_TZ_HEADER,
  addCalendarDays,
  calendarDateInTimeZone,
  normalizeCalendarTimeZoneHeader,
  utcCalendarDateString,
} from "@workspace/habit-dates";
import {
  awardCoins,
  awardFoodAndWater,
  getWallet,
  COINS_PER_COMPLETION,
  FOOD_PER_COMPLETION,
  WATER_PER_COMPLETION,
} from "./rewards";
import {
  CreateHabitBody,
  UpdateHabitBody,
  GetHabitParams,
  UpdateHabitParams,
  DeleteHabitParams,
  CompleteHabitParams,
  CompleteHabitBody,
  UncompleteHabitParams,
  UncompleteHabitBody,
  UpdateCompletionBody,
  GetHabitCompletionsParams,
  GetHabitCompletionsQueryParams,
  ListCompletionsInRangeQueryParams,
  GetHistoryQueryParams,
  ListHabitsQueryParams,
  ArchiveHabitParams,
  UnarchiveHabitParams,
} from "@workspace/api-zod";

const router = Router();

/** "Today" for habit streaks / completedToday — uses client `X-Habit-Calendar-Timezone` when valid, else UTC (legacy). */
function habitCalendarToday(req: Request): string {
  const raw = req.get(HABIT_CALENDAR_TZ_HEADER);
  const tz = normalizeCalendarTimeZoneHeader(raw ?? undefined);
  if (tz) return calendarDateInTimeZone(new Date(), tz);
  return utcCalendarDateString(new Date());
}

function toDateString(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

async function ownsHabit(walletId: string, habitId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: habitsTable.id })
    .from(habitsTable)
    .where(and(eq(habitsTable.id, habitId), eq(habitsTable.walletId, walletId)));
  return !!row;
}

async function computeStreak(
  habitId: number,
  todayStr: string,
): Promise<{ currentStreak: number; longestStreak: number }> {
  const completions = await db
    .select({ completedDate: habitCompletionsTable.completedDate })
    .from(habitCompletionsTable)
    .where(eq(habitCompletionsTable.habitId, habitId))
    .orderBy(desc(habitCompletionsTable.completedDate));

  if (completions.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const dates = completions.map((c) => c.completedDate);
  const dateSet = new Set(dates);

  let currentStreak = 0;
  let check = todayStr;
  while (dateSet.has(check)) {
    currentStreak++;
    check = addCalendarDays(check, -1);
  }
  if (currentStreak === 0) {
    check = addCalendarDays(todayStr, -1);
    while (dateSet.has(check)) {
      currentStreak++;
      check = addCalendarDays(check, -1);
    }
  }

  const sorted = [...dates].sort();
  let longestStreak = 1;
  let runStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === addCalendarDays(sorted[i - 1]!, 1)) {
      runStreak++;
      longestStreak = Math.max(longestStreak, runStreak);
    } else {
      runStreak = 1;
    }
  }

  return { currentStreak, longestStreak };
}

async function enrichHabit(habit: typeof habitsTable.$inferSelect, req: Request) {
  const todayStr = habitCalendarToday(req);
  const { currentStreak, longestStreak } = await computeStreak(habit.id, todayStr);
  const [todays] = await db
    .select()
    .from(habitCompletionsTable)
    .where(and(eq(habitCompletionsTable.habitId, habit.id), eq(habitCompletionsTable.completedDate, todayStr)));

  return {
    ...habit,
    currentStreak,
    longestStreak,
    completedToday: !!todays,
    todayMood: todays?.mood ?? null,
    todayNote: todays?.note ?? null,
  };
}

function isValidMood(m: unknown): m is (typeof HABIT_MOODS)[number] {
  return typeof m === "string" && (HABIT_MOODS as readonly string[]).includes(m);
}

function normalizeMood(m: unknown): string | null {
  if (m === null || m === undefined) return null;
  if (isValidMood(m)) return m;
  return null;
}

function normalizeNote(n: unknown): string | null {
  if (n === null || n === undefined) return null;
  if (typeof n !== "string") return null;
  const trimmed = n.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, NOTE_MAX_LENGTH);
}

function serializeCompletion(c: typeof habitCompletionsTable.$inferSelect) {
  return {
    id: c.id,
    habitId: c.habitId,
    completedDate: c.completedDate,
    mood: c.mood ?? null,
    note: c.note ?? null,
  };
}

router.get("/habits", async (req, res) => {
  const walletId = req.walletId;
  const queryParsed = ListHabitsQueryParams.safeParse(req.query);
  const archived = queryParsed.success ? queryParsed.data.archived : false;
  try {
    const habits = await db
      .select()
      .from(habitsTable)
      .where(
        and(
          eq(habitsTable.walletId, walletId),
          archived ? isNotNull(habitsTable.archivedAt) : isNull(habitsTable.archivedAt),
        ),
      )
      .orderBy(habitsTable.createdAt);
    const enriched = await Promise.all(habits.map((h) => enrichHabit(h, req)));
    res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list habits");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/habits", async (req, res) => {
  const walletId = req.walletId;
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const [habit] = await db
      .insert(habitsTable)
      .values({
        walletId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        color: parsed.data.color,
        icon: parsed.data.icon,
        targetDays: parsed.data.targetDays,
        reminderEnabled: parsed.data.reminderEnabled ?? false,
        reminderTimes: parsed.data.reminderTimes ?? [],
      })
      .returning();
    const enriched = await enrichHabit(habit, req);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to create habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/habits/:id", async (req, res) => {
  const walletId = req.walletId;
  const parsed = GetHabitParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [habit] = await db
      .select()
      .from(habitsTable)
      .where(and(eq(habitsTable.id, parsed.data.id), eq(habitsTable.walletId, walletId)));
    if (!habit) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    res.json(await enrichHabit(habit, req));
  } catch (err) {
    req.log.error({ err }, "Failed to get habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/habits/:id", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = UpdateHabitParams.safeParse(req.params);
  const bodyParsed = UpdateHabitBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    const [habit] = await db
      .update(habitsTable)
      .set({
        name: bodyParsed.data.name,
        description: bodyParsed.data.description ?? null,
        color: bodyParsed.data.color,
        icon: bodyParsed.data.icon,
        targetDays: bodyParsed.data.targetDays,
        reminderEnabled: bodyParsed.data.reminderEnabled ?? false,
        reminderTimes: bodyParsed.data.reminderTimes ?? [],
      })
      .where(and(eq(habitsTable.id, paramsParsed.data.id), eq(habitsTable.walletId, walletId)))
      .returning();
    if (!habit) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    res.json(await enrichHabit(habit, req));
  } catch (err) {
    req.log.error({ err }, "Failed to update habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/habits/:id", async (req, res) => {
  const walletId = req.walletId;
  const parsed = DeleteHabitParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await db
      .delete(habitsTable)
      .where(and(eq(habitsTable.id, parsed.data.id), eq(habitsTable.walletId, walletId)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/habits/:id/archive", async (req, res) => {
  const walletId = req.walletId;
  const parsed = ArchiveHabitParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [habit] = await db
      .update(habitsTable)
      .set({ archivedAt: new Date() })
      .where(and(eq(habitsTable.id, parsed.data.id), eq(habitsTable.walletId, walletId)))
      .returning();
    if (!habit) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    res.json(await enrichHabit(habit, req));
  } catch (err) {
    req.log.error({ err }, "Failed to archive habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/habits/:id/unarchive", async (req, res) => {
  const walletId = req.walletId;
  const parsed = UnarchiveHabitParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [habit] = await db
      .update(habitsTable)
      .set({ archivedAt: null })
      .where(and(eq(habitsTable.id, parsed.data.id), eq(habitsTable.walletId, walletId)))
      .returning();
    if (!habit) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    res.json(await enrichHabit(habit, req));
  } catch (err) {
    req.log.error({ err }, "Failed to unarchive habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/habits/:id/complete", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = CompleteHabitParams.safeParse(req.params);
  const bodyParsed = CompleteHabitBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    if (!(await ownsHabit(walletId, paramsParsed.data.id))) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    const dateStr = toDateString(bodyParsed.data.date);
    const mood = normalizeMood(bodyParsed.data.mood);
    const note = normalizeNote(bodyParsed.data.note);
    const inserted = await db
      .insert(habitCompletionsTable)
      .values({ habitId: paramsParsed.data.id, completedDate: dateStr, mood, note })
      .onConflictDoNothing({
        target: [habitCompletionsTable.habitId, habitCompletionsTable.completedDate],
      })
      .returning();
    if (inserted.length === 0) {
      const updates: { mood?: string | null; note?: string | null } = {};
      if (bodyParsed.data.mood !== undefined) updates.mood = mood;
      if (bodyParsed.data.note !== undefined) updates.note = note;
      let existing: typeof habitCompletionsTable.$inferSelect | undefined;
      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(habitCompletionsTable)
          .set(updates)
          .where(
            and(
              eq(habitCompletionsTable.habitId, paramsParsed.data.id),
              eq(habitCompletionsTable.completedDate, dateStr)
            )
          )
          .returning();
        existing = updated;
      } else {
        [existing] = await db
          .select()
          .from(habitCompletionsTable)
          .where(
            and(
              eq(habitCompletionsTable.habitId, paramsParsed.data.id),
              eq(habitCompletionsTable.completedDate, dateStr)
            )
          );
      }
      const wallet = await getWallet(walletId);
      res.status(201).json({
        completion: serializeCompletion(existing!),
        coinsAwarded: 0,
        foodAwarded: 0,
        waterAwarded: 0,
        wallet,
      });
      return;
    }
    const completion = inserted[0];
    await awardCoins(walletId, COINS_PER_COMPLETION);
    const wallet = await awardFoodAndWater(walletId, FOOD_PER_COMPLETION, WATER_PER_COMPLETION);
    res.status(201).json({
      completion: serializeCompletion(completion),
      coinsAwarded: COINS_PER_COMPLETION,
      foodAwarded: FOOD_PER_COMPLETION,
      waterAwarded: WATER_PER_COMPLETION,
      wallet,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to complete habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/habits/:id/complete", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = CompleteHabitParams.safeParse(req.params);
  const bodyParsed = UpdateCompletionBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    if (!(await ownsHabit(walletId, paramsParsed.data.id))) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    const dateStr = toDateString(bodyParsed.data.date);
    const updates: { mood?: string | null; note?: string | null } = {};
    if (bodyParsed.data.mood !== undefined) updates.mood = normalizeMood(bodyParsed.data.mood);
    if (bodyParsed.data.note !== undefined) updates.note = normalizeNote(bodyParsed.data.note);
    if (Object.keys(updates).length === 0) {
      const [existing] = await db
        .select()
        .from(habitCompletionsTable)
        .where(
          and(
            eq(habitCompletionsTable.habitId, paramsParsed.data.id),
            eq(habitCompletionsTable.completedDate, dateStr)
          )
        );
      if (!existing) {
        res.status(404).json({ error: "Completion not found" });
        return;
      }
      res.json(serializeCompletion(existing));
      return;
    }
    const [updated] = await db
      .update(habitCompletionsTable)
      .set(updates)
      .where(
        and(
          eq(habitCompletionsTable.habitId, paramsParsed.data.id),
          eq(habitCompletionsTable.completedDate, dateStr)
        )
      )
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Completion not found" });
      return;
    }
    res.json(serializeCompletion(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update completion");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/habits/:id/complete", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = UncompleteHabitParams.safeParse(req.params);
  const bodyParsed = UncompleteHabitBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  try {
    if (!(await ownsHabit(walletId, paramsParsed.data.id))) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    const dateStr = toDateString(bodyParsed.data.date);
    await db
      .delete(habitCompletionsTable)
      .where(
        and(
          eq(habitCompletionsTable.habitId, paramsParsed.data.id),
          eq(habitCompletionsTable.completedDate, dateStr)
        )
      );
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to uncomplete habit");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function listOwnedHabitIds(walletId: string): Promise<number[]> {
  const rows = await db
    .select({ id: habitsTable.id })
    .from(habitsTable)
    .where(eq(habitsTable.walletId, walletId));
  return rows.map((r) => r.id);
}

router.get("/completions", async (req, res) => {
  const walletId = req.walletId;
  const queryParsed = ListCompletionsInRangeQueryParams.safeParse(req.query);
  if (!queryParsed.success) {
    res.status(400).json({ error: "Invalid query: from and to (YYYY-MM-DD) are required" });
    return;
  }
  const { from, to, habitId } = queryParsed.data;
  if (from > to) {
    res.status(400).json({ error: "'from' must be on or before 'to'" });
    return;
  }
  try {
    const ownedIds = await listOwnedHabitIds(walletId);
    if (ownedIds.length === 0) {
      res.json([]);
      return;
    }
    if (habitId !== undefined && !ownedIds.includes(habitId)) {
      res.json([]);
      return;
    }
    const conditions = [
      gte(habitCompletionsTable.completedDate, from),
      lte(habitCompletionsTable.completedDate, to),
      habitId !== undefined
        ? eq(habitCompletionsTable.habitId, habitId)
        : inArray(habitCompletionsTable.habitId, ownedIds),
    ];
    const completions = await db
      .select()
      .from(habitCompletionsTable)
      .where(and(...conditions))
      .orderBy(habitCompletionsTable.completedDate);
    res.json(completions.map(serializeCompletion));
  } catch (err) {
    req.log.error({ err }, "Failed to list completions in range");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/habits/:id/completions", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = GetHabitCompletionsParams.safeParse(req.params);
  const queryParsed = GetHabitCompletionsQueryParams.safeParse(req.query);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const days = queryParsed.success ? (queryParsed.data.days ?? 30) : 30;
  try {
    if (!(await ownsHabit(walletId, paramsParsed.data.id))) {
      res.status(404).json({ error: "Habit not found" });
      return;
    }
    const since = addCalendarDays(habitCalendarToday(req), -days);
    const completions = await db
      .select()
      .from(habitCompletionsTable)
      .where(
        and(
          eq(habitCompletionsTable.habitId, paramsParsed.data.id),
          gte(habitCompletionsTable.completedDate, since)
        )
      )
      .orderBy(desc(habitCompletionsTable.completedDate));
    res.json(completions.map(serializeCompletion));
  } catch (err) {
    req.log.error({ err }, "Failed to get completions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", async (req, res) => {
  const walletId = req.walletId;
  const parsed = GetHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid year/month" });
    return;
  }
  try {
    const { year, month } = parsed.data;
    const start = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = `${nextYear.toString().padStart(4, "0")}-${nextMonth.toString().padStart(2, "0")}-01`;

    const habits = await db
      .select()
      .from(habitsTable)
      .where(eq(habitsTable.walletId, walletId))
      .orderBy(habitsTable.createdAt);

    const habitIds = habits.map((h) => h.id);
    const completions =
      habitIds.length === 0
        ? []
        : await db
            .select()
            .from(habitCompletionsTable)
            .where(
              and(
                inArray(habitCompletionsTable.habitId, habitIds),
                gte(habitCompletionsTable.completedDate, start),
                lt(habitCompletionsTable.completedDate, end)
              )
            )
            .orderBy(asc(habitCompletionsTable.completedDate));

    const byHabit = new Map<number, typeof completions>();
    for (const c of completions) {
      const arr = byHabit.get(c.habitId);
      if (arr) arr.push(c);
      else byHabit.set(c.habitId, [c]);
    }

    const [earliest] =
      habitIds.length === 0
        ? [undefined as { d: string } | undefined]
        : await db
            .select({ d: habitCompletionsTable.completedDate })
            .from(habitCompletionsTable)
            .where(inArray(habitCompletionsTable.habitId, habitIds))
            .orderBy(asc(habitCompletionsTable.completedDate))
            .limit(1);

    res.json({
      year,
      month,
      earliestCompletionDate: earliest?.d ?? null,
      habits: habits.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        icon: h.icon,
        completions: (byHabit.get(h.id) ?? []).map((c) => ({
          completedDate: c.completedDate,
          mood: c.mood ?? null,
          note: c.note ?? null,
        })),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard", async (req, res) => {
  const walletId = req.walletId;
  const todayStr = habitCalendarToday(req);
  try {
    const habits = await db
      .select()
      .from(habitsTable)
      .where(and(eq(habitsTable.walletId, walletId), isNull(habitsTable.archivedAt)));
    const totalHabits = habits.length;

    if (totalHabits === 0) {
      res.json({
        todayCompletionRate: 0,
        totalHabits: 0,
        completedToday: 0,
        longestActiveStreak: 0,
        weeklyCompletionRate: 0,
        habitStats: [],
      });
      return;
    }

    const weekAgo = addCalendarDays(todayStr, -7);

    const activeHabitIds = habits.map((h) => h.id);
    const activeIdSet = new Set(activeHabitIds);
    const allCompletionsRaw = await db
      .select()
      .from(habitCompletionsTable)
      .where(
        and(
          inArray(habitCompletionsTable.habitId, activeHabitIds),
          gte(habitCompletionsTable.completedDate, weekAgo),
        ),
      );
    const allCompletions = allCompletionsRaw.filter((c) => activeIdSet.has(c.habitId));

    const todayCompletions = allCompletions.filter((c) => c.completedDate === todayStr);
    const completedTodayCount = new Set(todayCompletions.map((c) => c.habitId)).size;

    const weeklyCount = allCompletions.length;
    const weeklyPossible = totalHabits * 7;
    const weeklyCompletionRate = weeklyPossible > 0 ? weeklyCount / weeklyPossible : 0;

    const habitStats = await Promise.all(
      habits.map(async (h) => {
        const { currentStreak, longestStreak } = await computeStreak(h.id, todayStr);
        const completedToday = todayCompletions.some((c) => c.habitId === h.id);
        const weeklyCompletions = allCompletions.filter((c) => c.habitId === h.id).length;
        const totalCompletionsResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(habitCompletionsTable)
          .where(eq(habitCompletionsTable.habitId, h.id));
        return {
          habitId: h.id,
          name: h.name,
          color: h.color,
          icon: h.icon,
          currentStreak,
          longestStreak,
          completedToday,
          weeklyCompletions,
          totalCompletions: totalCompletionsResult[0]?.count ?? 0,
        };
      })
    );

    const longestActiveStreak = habitStats.reduce((max, s) => Math.max(max, s.currentStreak), 0);

    res.json({
      todayCompletionRate: totalHabits > 0 ? completedTodayCount / totalHabits : 0,
      totalHabits,
      completedToday: completedTodayCount,
      longestActiveStreak,
      weeklyCompletionRate,
      habitStats,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
