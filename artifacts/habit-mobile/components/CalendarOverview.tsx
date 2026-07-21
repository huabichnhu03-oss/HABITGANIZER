import { Feather } from "@expo/vector-icons";
import {
  useListCompletionsInRange,
  useListHabits,
  type Habit,
  type HabitCompletion,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BrutalCard } from "@/components/BrutalCard";
import { useColors } from "@/hooks/useColors";
import { getReadableForeground, resolveHabitColor } from "@/lib/colors";

const DOW = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function toKey(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function todayKey() {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}
function dowKey(y: number, m: number, d: number) {
  return DOW_KEYS[new Date(y, m, d).getDay()];
}
function isHabitScheduled(h: Habit, y: number, m: number, d: number) {
  const days = h.targetDays ?? ["all"];
  if (days.includes("all")) return true;
  return days.includes(dowKey(y, m, d));
}

interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  scheduledHabits: Habit[];
  completedHabits: { habit: Habit; completion: HabitCompletion }[];
}

interface Props {
  habits: Habit[];
}

export function CalendarOverview({ habits }: Props) {
  const colors = useColors();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [filter, setFilter] = useState<number | "all">("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const lastDay = new Date(year, month + 1, 0).getDate();
  const fromStr = toKey(year, month, 1);
  const toStr = toKey(year, month, lastDay);

  const { data: completions, isLoading } = useListCompletionsInRange({
    from: fromStr,
    to: toStr,
    ...(filter !== "all" ? { habitId: filter } : {}),
  });

  // Also load archived habits so completions belonging to a habit that was
  // archived after the fact still resolve to a habit in the calendar UI.
  const { data: archivedHabits } = useListHabits({ archived: true });

  const habitsById = useMemo(() => {
    const m = new Map<number, { habit: Habit; index: number }>();
    habits.forEach((h, i) => m.set(h.id, { habit: h, index: i }));
    (archivedHabits ?? []).forEach((h, i) => {
      if (!m.has(h.id)) m.set(h.id, { habit: h, index: habits.length + i });
    });
    return m;
  }, [habits, archivedHabits]);

  const filteredHabits = useMemo(
    () => (filter === "all" ? habits : habits.filter((h) => h.id === filter)),
    [habits, filter],
  );

  const cells = useMemo<DayCell[]>(() => {
    const result: DayCell[] = [];
    const firstDow = new Date(year, month, 1).getDay();
    const compsByDay = new Map<string, HabitCompletion[]>();
    (completions ?? []).forEach((c) => {
      const k = c.completedDate.slice(0, 10);
      const arr = compsByDay.get(k) ?? [];
      arr.push(c);
      compsByDay.set(k, arr);
    });
    const today = todayKey();
    for (let i = 0; i < firstDow; i++) {
      result.push({
        key: `pad-${i}`,
        day: 0,
        inMonth: false,
        isToday: false,
        isFuture: false,
        scheduledHabits: [],
        completedHabits: [],
      });
    }
    for (let d = 1; d <= lastDay; d++) {
      const k = toKey(year, month, d);
      const dayComps = compsByDay.get(k) ?? [];
      const scheduled = filteredHabits.filter((h) => isHabitScheduled(h, year, month, d));
      const completed = dayComps
        .map((c) => {
          const lookup = habitsById.get(c.habitId);
          if (!lookup) return null;
          if (filter !== "all" && lookup.habit.id !== filter) return null;
          return { habit: lookup.habit, completion: c };
        })
        .filter((x): x is { habit: Habit; completion: HabitCompletion } => x !== null);
      result.push({
        key: k,
        day: d,
        inMonth: true,
        isToday: k === today,
        isFuture: k > today,
        scheduledHabits: scheduled,
        completedHabits: completed,
      });
    }
    while (result.length % 7 !== 0) {
      result.push({
        key: `tail-${result.length}`,
        day: 0,
        inMonth: false,
        isToday: false,
        isFuture: false,
        scheduledHabits: [],
        completedHabits: [],
      });
    }
    return result;
  }, [completions, filteredHabits, habitsById, filter, year, month, lastDay]);

  const goPrev = () => {
    setSelectedKey(null);
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const goNext = () => {
    setSelectedKey(null);
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };

  const selectedCell = selectedKey ? cells.find((c) => c.key === selectedKey) : null;

  return (
    <BrutalCard background={colors.card} shadowOffset={6}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goPrev}
            testID="calendar-prev"
            style={[styles.navBtn, { borderColor: colors.foreground, backgroundColor: colors.background }]}
          >
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </Pressable>
          <Text
            style={[styles.monthLabel, { color: colors.foreground }]}
            testID="calendar-month-label"
          >
            {MONTHS[month]} {year}
          </Text>
          <Pressable
            onPress={goNext}
            testID="calendar-next"
            style={[styles.navBtn, { borderColor: colors.foreground, backgroundColor: colors.background }]}
          >
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="All"
            active={filter === "all"}
            onPress={() => {
              setFilter("all");
              setSelectedKey(null);
            }}
            testID="filter-all"
            colors={colors}
          />
          {habits.map((h, i) => {
            const c = resolveHabitColor(h.color, i);
            const active = filter === h.id;
            return (
              <Pressable
                key={h.id}
                onPress={() => {
                  setFilter(active ? "all" : h.id);
                  setSelectedKey(null);
                }}
                testID={`filter-habit-${h.id}`}
                style={[
                  styles.chip,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: active ? c : colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? getReadableForeground(c) : colors.foreground },
                  ]}
                  numberOfLines={1}
                >
                  {h.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.dowRow}>
          {DOW.map((d, i) => (
            <Text
              key={`dow-${i}`}
              style={[styles.dowText, { color: colors.mutedForeground }]}
            >
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid} testID="calendar-grid">
          {cells.map((cell) => {
            if (!cell.inMonth) {
              return <View key={cell.key} style={styles.cellPad} />;
            }
            const completedCount = cell.completedHabits.length;
            const scheduledCount = cell.scheduledHabits.length;
            const ratio =
              scheduledCount > 0 ? Math.min(1, completedCount / scheduledCount) : 0;
            let bg = colors.background;
            let cellFg = colors.foreground;
            if (scheduledCount === 0 && !cell.isFuture) {
              bg = colors.muted;
            }
            if (filter === "all" && ratio > 0) {
              const opacity = 0.18 + ratio * 0.55;
              bg = `rgba(66, 88, 214, ${opacity.toFixed(2)})`;
            } else if (filter !== "all" && completedCount > 0) {
              const lookup = habitsById.get(filter);
              if (lookup) {
                bg = resolveHabitColor(lookup.habit.color, lookup.index);
                cellFg = getReadableForeground(bg);
              }
            }
            const isSelected = selectedKey === cell.key;
            return (
              <Pressable
                key={cell.key}
                onPress={() =>
                  setSelectedKey((prev) => (prev === cell.key ? null : cell.key))
                }
                testID={`day-${cell.key}`}
                style={[
                  styles.cell,
                  {
                    backgroundColor: bg,
                    borderColor: isSelected ? colors.foreground : colors.border,
                    borderWidth: isSelected ? 3 : 1.5,
                    opacity: cell.isFuture ? 0.5 : 1,
                  },
                  cell.isToday && {
                    borderColor: colors.accent,
                    borderWidth: 3,
                  },
                ]}
              >
                <Text style={[styles.cellDay, { color: cellFg }]}>
                  {cell.day}
                </Text>
                {filter === "all" && completedCount > 0 ? (
                  <View style={styles.dotRow}>
                    {cell.completedHabits.slice(0, 3).map(({ habit }) => {
                      const lookup = habitsById.get(habit.id);
                      const c = resolveHabitColor(habit.color, lookup?.index ?? 0);
                      return (
                        <View
                          key={habit.id}
                          style={[
                            styles.dot,
                            { backgroundColor: c, borderColor: colors.foreground },
                          ]}
                        />
                      );
                    })}
                  </View>
                ) : null}
                {filter !== "all" && completedCount > 0 ? (
                  <Feather name="check" size={14} color={cellFg} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <Text style={[styles.loading, { color: colors.mutedForeground }]} testID="calendar-loading">
            Loading...
          </Text>
        ) : null}

        <View style={styles.legend}>
          <LegendItem
            color={colors.background}
            border={colors.foreground}
            label="Scheduled"
            colors={colors}
          />
          <LegendItem
            color={colors.muted}
            border={colors.foreground}
            label="Not scheduled"
            colors={colors}
          />
          <LegendItem
            color={colors.background}
            border={colors.accent}
            label="Today"
            colors={colors}
          />
        </View>

        {selectedCell ? (
          <DayDetail
            cell={selectedCell}
            onClose={() => setSelectedKey(null)}
            habitsById={habitsById}
            colors={colors}
          />
        ) : null}
      </View>
    </BrutalCard>
  );
}

function FilterChip({
  label,
  active,
  onPress,
  testID,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={[
        styles.chip,
        {
          borderColor: colors.foreground,
          backgroundColor: active ? colors.foreground : colors.background,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.accent : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LegendItem({
  color,
  border,
  label,
  colors,
}: {
  color: string;
  border: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: color, borderColor: border },
        ]}
      />
      <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function DayDetail({
  cell,
  onClose,
  habitsById,
  colors,
}: {
  cell: DayCell;
  onClose: () => void;
  habitsById: Map<number, { habit: Habit; index: number }>;
  colors: ReturnType<typeof useColors>;
}) {
  const completedIds = new Set(cell.completedHabits.map((c) => c.habit.id));
  const missed = cell.scheduledHabits.filter((h) => !completedIds.has(h.id));
  const date = new Date(cell.key + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.detail, { backgroundColor: colors.background, borderColor: colors.foreground }]} testID="day-detail">
      <View style={styles.detailHeader}>
        <Text style={[styles.detailDate, { color: colors.foreground }]} testID="day-detail-date">
          {date}
        </Text>
        <Pressable
          onPress={onClose}
          testID="day-detail-close"
          style={[styles.closeBtn, { borderColor: colors.foreground, backgroundColor: colors.card }]}
        >
          <Feather name="x" size={16} color={colors.foreground} />
        </Pressable>
      </View>

      {cell.completedHabits.length === 0 && missed.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]} testID="day-detail-empty">
          No habits scheduled.
        </Text>
      ) : null}

      {cell.completedHabits.length > 0 ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DONE</Text>
          {cell.completedHabits.map(({ habit, completion }) => {
            const lookup = habitsById.get(habit.id);
            const c = resolveHabitColor(habit.color, lookup?.index ?? 0);
            return (
              <View
                key={habit.id}
                style={styles.detailRow}
                testID={`day-detail-done-${habit.id}`}
              >
                <View style={[styles.colorDot, { backgroundColor: c, borderColor: colors.foreground }]} />
                <Text style={[styles.detailHabit, { color: colors.foreground }]} numberOfLines={1}>
                  {habit.name}
                </Text>
                {completion.note ? (
                  <Text style={[styles.detailNote, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {completion.note}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {missed.length > 0 ? (
        <View>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MISSED</Text>
          {missed.map((habit) => {
            const lookup = habitsById.get(habit.id);
            const c = resolveHabitColor(habit.color, lookup?.index ?? 0);
            return (
              <View
                key={habit.id}
                style={[styles.detailRow, { opacity: 0.65 }]}
                testID={`day-detail-missed-${habit.id}`}
              >
                <View style={[styles.colorDot, { backgroundColor: colors.background, borderColor: c }]} />
                <Text style={[styles.detailHabit, { color: colors.foreground }]} numberOfLines={1}>
                  {habit.name}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
  container: { padding: 14, gap: 12 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 18,
    letterSpacing: -0.5,
    textTransform: "uppercase",
    flex: 1,
    textAlign: "center",
  },
  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    maxWidth: 140,
  },
  chipText: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  dowRow: { flexDirection: "row", justifyContent: "space-between" },
  dowText: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 1,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CELL_GAP },
  cell: {
    width: `${(100 - CELL_GAP * 6 * 0.7) / 7}%`,
    aspectRatio: 1,
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  cellPad: {
    width: `${(100 - CELL_GAP * 6 * 0.7) / 7}%`,
    aspectRatio: 1,
  },
  cellDay: {
    fontFamily: "Inter_900Black",
    fontSize: 12,
    alignSelf: "flex-start",
  },
  dotRow: { flexDirection: "row", gap: 2, flexWrap: "wrap", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 999, borderWidth: 1 },
  loading: { fontFamily: "Inter_700Bold", fontSize: 12 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendSwatch: { width: 14, height: 14, borderRadius: 3, borderWidth: 2 },
  legendText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  detail: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    gap: 6,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailDate: {
    fontFamily: "Inter_900Black",
    fontSize: 16,
    letterSpacing: -0.3,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  detailHabit: { fontFamily: "Inter_800ExtraBold", fontSize: 14, flexShrink: 1 },
  detailNote: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  emptyText: { fontFamily: "Inter_700Bold", fontSize: 13 },
});
