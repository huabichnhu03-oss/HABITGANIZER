import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import {
  useListCompletionsInRange,
  useListHabits,
  type Habit,
  type HabitCompletion,
} from "@workspace/api-client-react";
import { DynamicIcon, getHabitColor, getReadableForeground } from "@/components/icons";

type DayKey = string;

const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function toKey(year: number, month: number, day: number): DayKey {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function todayKey(): DayKey {
  const d = new Date();
  return toKey(d.getFullYear(), d.getMonth(), d.getDate());
}
function dowKey(year: number, month: number, day: number): (typeof DOW_KEYS)[number] {
  return DOW_KEYS[new Date(year, month, day).getDay()];
}
function isHabitScheduled(habit: Habit, year: number, month: number, day: number): boolean {
  const days = habit.targetDays ?? ["all"];
  if (days.includes("all")) return true;
  return days.includes(dowKey(year, month, day));
}

interface DayCellInfo {
  key: DayKey;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  scheduledHabits: Habit[];
  completedHabits: { habit: Habit; completion: HabitCompletion }[];
}

interface CalendarOverviewProps {
  habits: Habit[];
}

export function CalendarOverview({ habits }: CalendarOverviewProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [filterHabitId, setFilterHabitId] = useState<number | "all">("all");
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);

  const fromKey = toKey(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const toKeyStr = toKey(viewYear, viewMonth, lastDay);

  const { data: completions, isLoading } = useListCompletionsInRange({
    from: fromKey,
    to: toKeyStr,
    ...(filterHabitId !== "all" ? { habitId: filterHabitId } : {}),
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
    () => (filterHabitId === "all" ? habits : habits.filter((h) => h.id === filterHabitId)),
    [habits, filterHabitId],
  );

  const cells = useMemo<DayCellInfo[]>(() => {
    const result: DayCellInfo[] = [];
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const completionsByDay = new Map<DayKey, HabitCompletion[]>();
    (completions ?? []).forEach((c) => {
      const key = c.completedDate.slice(0, 10);
      const arr = completionsByDay.get(key) ?? [];
      arr.push(c);
      completionsByDay.set(key, arr);
    });

    const today = todayKey();
    // Leading blanks from previous month
    for (let i = 0; i < firstDow; i++) {
      result.push({
        key: `pad-pre-${i}`,
        day: 0,
        inMonth: false,
        isToday: false,
        isFuture: false,
        scheduledHabits: [],
        completedHabits: [],
      });
    }
    for (let d = 1; d <= lastDay; d++) {
      const key = toKey(viewYear, viewMonth, d);
      const dayCompletions = completionsByDay.get(key) ?? [];
      const scheduled = filteredHabits.filter((h) => isHabitScheduled(h, viewYear, viewMonth, d));
      const completed = dayCompletions
        .map((c) => {
          const lookup = habitsById.get(c.habitId);
          if (!lookup) return null;
          if (filterHabitId !== "all" && lookup.habit.id !== filterHabitId) return null;
          return { habit: lookup.habit, completion: c };
        })
        .filter((x): x is { habit: Habit; completion: HabitCompletion } => x !== null);
      result.push({
        key,
        day: d,
        inMonth: true,
        isToday: key === today,
        isFuture: key > today,
        scheduledHabits: scheduled,
        completedHabits: completed,
      });
    }
    // Trailing blanks
    while (result.length % 7 !== 0) {
      result.push({
        key: `pad-post-${result.length}`,
        day: 0,
        inMonth: false,
        isToday: false,
        isFuture: false,
        scheduledHabits: [],
        completedHabits: [],
      });
    }
    return result;
  }, [completions, filteredHabits, habitsById, filterHabitId, viewYear, viewMonth, lastDay]);

  const goPrev = () => {
    setSelectedDay(null);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNext = () => {
    setSelectedDay(null);
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectedCell = selectedDay ? cells.find((c) => c.key === selectedDay) : null;

  return (
    <div className="brutal-card bg-white p-6 sm:p-8" data-testid="calendar-overview">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
          <CalendarIcon className="w-8 h-8" strokeWidth={3} /> Calendar
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            data-testid="calendar-prev"
            aria-label="Previous month"
            className="p-3 rounded-xl border-brutal-sm bg-background hover:bg-muted active:translate-y-0.5 transition-all"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={3} />
          </button>
          <div
            className="px-4 py-2 text-xl font-black uppercase tracking-tight min-w-[180px] text-center"
            data-testid="calendar-month-label"
          >
            {MONTH_LABELS[viewMonth]} {viewYear}
          </div>
          <button
            type="button"
            onClick={goNext}
            data-testid="calendar-next"
            aria-label="Next month"
            className="p-3 rounded-xl border-brutal-sm bg-background hover:bg-muted active:translate-y-0.5 transition-all"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" data-testid="calendar-filters">
        <FilterChip
          label="All habits"
          active={filterHabitId === "all"}
          onClick={() => {
            setFilterHabitId("all");
            setSelectedDay(null);
          }}
          testId="filter-all"
        />
        {habits.map((h, i) => {
          const color = getHabitColor(h, i);
          const active = filterHabitId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              data-testid={`filter-habit-${h.id}`}
              onClick={() => {
                setFilterHabitId(active ? "all" : h.id);
                setSelectedDay(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-brutal-sm font-black uppercase text-sm tracking-wide transition-all ${
                active ? "shadow-brutal-sm scale-105" : "hover:bg-muted"
              }`}
              style={{
                backgroundColor: active ? color.hex : "white",
                color: active ? getReadableForeground(color.hex) : undefined,
              }}
            >
              <DynamicIcon name={h.icon} className="w-4 h-4" strokeWidth={3} />
              <span>{h.name}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DOW_LABELS.map((d, i) => (
          <div
            key={`dow-${i}`}
            className="text-center font-black uppercase text-xs tracking-widest text-muted-foreground py-2"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" data-testid="calendar-grid">
        {cells.map((cell) =>
          cell.inMonth ? (
            <DayCell
              key={cell.key}
              cell={cell}
              isSelected={selectedDay === cell.key}
              onClick={() =>
                setSelectedDay((prev) => (prev === cell.key ? null : cell.key))
              }
              filterHabitId={filterHabitId}
              habitsById={habitsById}
            />
          ) : (
            <div key={cell.key} className="aspect-square" />
          ),
        )}
      </div>

      {isLoading && (
        <div className="mt-4 text-sm font-bold text-muted-foreground" data-testid="calendar-loading">
          Loading...
        </div>
      )}

      <Legend />

      {selectedCell && (
        <DayDetail
          cell={selectedCell}
          onClose={() => setSelectedDay(null)}
          habitsById={habitsById}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl border-brutal-sm font-black uppercase text-sm tracking-wide transition-all ${
        active
          ? "bg-foreground text-white shadow-brutal-sm scale-105"
          : "bg-white text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

function DayCell({
  cell,
  isSelected,
  onClick,
  filterHabitId,
  habitsById,
}: {
  cell: DayCellInfo;
  isSelected: boolean;
  onClick: () => void;
  filterHabitId: number | "all";
  habitsById: Map<number, { habit: Habit; index: number }>;
}) {
  const completedCount = cell.completedHabits.length;
  const scheduledCount = cell.scheduledHabits.length;
  const completionRatio =
    scheduledCount > 0 ? Math.min(1, completedCount / scheduledCount) : 0;

  // Heat-map fill: only when "All habits" filter is on.
  const fillStyle: React.CSSProperties = {};
  if (filterHabitId === "all" && completionRatio > 0) {
    const opacity = 0.18 + completionRatio * 0.55;
    fillStyle.backgroundColor = `rgba(66, 88, 214, ${opacity.toFixed(2)})`;
  } else if (filterHabitId !== "all" && completedCount > 0) {
    const lookup = habitsById.get(filterHabitId);
    if (lookup) {
      const c = getHabitColor(lookup.habit, lookup.index);
      fillStyle.backgroundColor = c.hex;
      fillStyle.color = getReadableForeground(c.hex);
    }
  }

  const notScheduled = scheduledCount === 0 && !cell.isFuture;

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`day-${cell.key}`}
      className={`aspect-square rounded-lg border-2 flex flex-col items-center justify-between p-1 sm:p-2 transition-all relative overflow-hidden text-left ${
        isSelected
          ? "border-foreground shadow-brutal-sm scale-105 z-10"
          : "border-border hover:border-foreground"
      } ${cell.isToday ? "ring-2 ring-accent ring-offset-1" : ""} ${
        notScheduled ? "bg-muted/40" : "bg-white"
      } ${cell.isFuture ? "opacity-50" : ""}`}
      style={fillStyle}
      aria-label={`${cell.key}: ${completedCount} of ${scheduledCount} habits completed`}
    >
      <span className="text-xs sm:text-sm font-black self-start" style={{ color: "inherit" }}>
        {cell.day}
      </span>
      {filterHabitId === "all" && cell.completedHabits.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center w-full">
          {cell.completedHabits.slice(0, 4).map(({ habit }) => {
            const lookup = habitsById.get(habit.id);
            const c = getHabitColor(habit, lookup?.index ?? 0);
            return (
              <span
                key={habit.id}
                className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full border border-foreground"
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
          {cell.completedHabits.length > 4 && (
            <span className="text-[8px] font-black">+{cell.completedHabits.length - 4}</span>
          )}
        </div>
      )}
      {filterHabitId !== "all" && cell.completedHabits.length > 0 && (
        <span className="text-base sm:text-lg font-black">✓</span>
      )}
    </button>
  );
}

function Legend() {
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold mt-4 text-muted-foreground"
      data-testid="calendar-legend"
    >
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded border-2 border-border bg-white" /> Scheduled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded border-2 border-border bg-muted/40" /> Not scheduled
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded border-2 border-border ring-2 ring-accent" /> Today
      </span>
    </div>
  );
}

function DayDetail({
  cell,
  onClose,
  habitsById,
}: {
  cell: DayCellInfo;
  onClose: () => void;
  habitsById: Map<number, { habit: Habit; index: number }>;
}) {
  const completedIds = new Set(cell.completedHabits.map((c) => c.habit.id));
  const missed = cell.scheduledHabits.filter((h) => !completedIds.has(h.id));
  const dateLabel = new Date(cell.key + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="mt-6 brutal-card bg-background p-6 animate-in fade-in slide-in-from-bottom-2 duration-200"
      data-testid="day-detail"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-black uppercase tracking-tight" data-testid="day-detail-date">
          {dateLabel}
        </h3>
        <button
          type="button"
          onClick={onClose}
          data-testid="day-detail-close"
          aria-label="Close day detail"
          className="p-2 rounded-lg border-brutal-sm bg-white hover:bg-muted active:translate-y-0.5"
        >
          <X className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>

      {cell.completedHabits.length === 0 && missed.length === 0 && (
        <p className="text-base font-bold text-muted-foreground" data-testid="day-detail-empty">
          No habits scheduled.
        </p>
      )}

      {cell.completedHabits.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">
            Done
          </p>
          <ul className="space-y-2">
            {cell.completedHabits.map(({ habit, completion }) => {
              const lookup = habitsById.get(habit.id);
              const c = getHabitColor(habit, lookup?.index ?? 0);
              return (
                <li
                  key={habit.id}
                  data-testid={`day-detail-done-${habit.id}`}
                  className="flex items-center gap-3"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center border-brutal-sm"
                    style={{ backgroundColor: c.hex, color: getReadableForeground(c.hex) }}
                  >
                    <DynamicIcon name={habit.icon} className="w-5 h-5" strokeWidth={3} />
                  </span>
                  <div className="flex-1">
                    <div className="font-black uppercase">{habit.name}</div>
                    {completion.note ? (
                      <div className="text-sm font-bold text-muted-foreground">
                        {completion.note}
                      </div>
                    ) : null}
                  </div>
                  {completion.mood ? (
                    <span className="text-xs font-black uppercase px-2 py-1 rounded border-brutal-sm bg-white">
                      {completion.mood}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {missed.length > 0 && (
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">
            Missed
          </p>
          <ul className="space-y-2">
            {missed.map((habit) => {
              const lookup = habitsById.get(habit.id);
              const c = getHabitColor(habit, lookup?.index ?? 0);
              return (
                <li
                  key={habit.id}
                  data-testid={`day-detail-missed-${habit.id}`}
                  className="flex items-center gap-3 opacity-70"
                >
                  <span
                    className="w-9 h-9 rounded-lg flex items-center justify-center border-brutal-sm bg-white"
                  >
                    <DynamicIcon name={habit.icon} className="w-5 h-5" style={{ color: c.hex }} strokeWidth={3} />
                  </span>
                  <div className="font-black uppercase">{habit.name}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CalendarOverviewSection() {
  const { data: habits } = useListHabits();
  const { data: archivedHabits } = useListHabits({ archived: true });
  if (!habits) return null;
  // Render the calendar whenever there is any habit (active or archived) so
  // archived habits' history remains visible after the last active habit
  // is archived.
  const hasAny = habits.length > 0 || (archivedHabits?.length ?? 0) > 0;
  if (!hasAny) {
    return (
      <div className="brutal-card bg-white p-8 text-center" data-testid="calendar-empty">
        <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-lg font-black uppercase">No habits yet</p>
        <p className="text-sm font-bold text-muted-foreground">
          Create a habit to start tracking your calendar.
        </p>
      </div>
    );
  }
  return <CalendarOverview habits={habits} />;
}
