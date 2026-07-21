import React, { useMemo, useState } from "react";
import { useGetHistory } from "@workspace/api-client-react";
import { DynamicIcon, getHabitColor, getReadableForeground } from "@/components/icons";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, History as HistoryIcon } from "lucide-react";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";

const MOOD_EMOJI: Record<string, string> = {
  great: "😀",
  good: "🙂",
  okay: "😐",
  meh: "😕",
  bad: "😞",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatYM(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function ymKey(year: number, month: number): number {
  return year * 12 + (month - 1);
}

function fromYmKey(k: number): { year: number; month: number } {
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
}

function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function HistoryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, isError, refetch } = useGetHistory({ year, month });

  const currentKey = ymKey(now.getFullYear(), now.getMonth() + 1);
  const viewKey = ymKey(year, month);

  const earliestKey = useMemo(() => {
    if (!data?.earliestCompletionDate) return viewKey;
    const d = new Date(`${data.earliestCompletionDate}T00:00:00`);
    return ymKey(d.getFullYear(), d.getMonth() + 1);
  }, [data?.earliestCompletionDate, viewKey]);

  const canGoBack = viewKey > earliestKey;
  const canGoForward = viewKey < currentKey;

  function goPrev() {
    if (!canGoBack) return;
    const next = fromYmKey(viewKey - 1);
    setYear(next.year);
    setMonth(next.month);
  }
  function goNext() {
    if (!canGoForward) return;
    const next = fromYmKey(viewKey + 1);
    setYear(next.year);
    setMonth(next.month);
  }

  const totalCompletions = useMemo(
    () => (data?.habits ?? []).reduce((sum, h) => sum + h.completions.length, 0),
    [data],
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <HistoryIcon className="w-10 h-10 text-foreground -rotate-6" strokeWidth={3} />
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">History</h1>
          <p className="text-base font-bold text-muted-foreground uppercase tracking-wide">
            Look back on your check-offs
          </p>
        </div>
      </header>

      <div className="brutal-card bg-white p-4 sm:p-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canGoBack}
          data-testid="history-prev-month"
          aria-label="Previous month"
          className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl border-brutal-sm shadow-brutal-sm bg-white hover:bg-muted active:translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:translate-y-0"
        >
          <ChevronLeft className="w-7 h-7" strokeWidth={3} />
        </button>
        <div className="flex flex-col items-center text-center min-w-0">
          <CalendarIcon className="w-5 h-5 text-muted-foreground mb-1" strokeWidth={3} />
          <h2
            data-testid="history-month-label"
            className="text-2xl sm:text-3xl font-black uppercase tracking-tight truncate"
          >
            {formatYM(year, month)}
          </h2>
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!canGoForward}
          data-testid="history-next-month"
          aria-label="Next month"
          className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-2xl border-brutal-sm shadow-brutal-sm bg-white hover:bg-muted active:translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:active:translate-y-0"
        >
          <ChevronRight className="w-7 h-7" strokeWidth={3} />
        </button>
      </div>

      {isError ? (
        <ApiQueryErrorBanner title="Couldn’t load history" onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted border-brutal shadow-brutal rounded-[2rem] animate-pulse" />
          ))}
        </div>
      ) : totalCompletions === 0 ? (
        <div
          data-testid="history-empty"
          className="brutal-card bg-muted text-center py-16 px-6"
        >
          <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" strokeWidth={2.5} />
          <h3 className="text-2xl font-black uppercase tracking-tight mb-2">Nothing logged this month</h3>
          <p className="text-base font-bold text-muted-foreground">
            Pick a different month or come back after you check things off.
          </p>
        </div>
      ) : (
        <div className="space-y-6" data-testid="history-list">
          {data.habits
            .filter((h) => h.completions.length > 0)
            .map((habit, i) => {
              const colorDef = getHabitColor(habit, i);
              return (
                <div
                  key={habit.id}
                  data-testid={`history-habit-${habit.id}`}
                  className="brutal-card bg-white p-5 sm:p-6"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border-brutal-sm shadow-brutal-sm"
                      style={{ backgroundColor: colorDef.hex, color: getReadableForeground(colorDef.hex) }}
                    >
                      <DynamicIcon name={habit.icon} className="w-6 h-6" strokeWidth={3} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black uppercase tracking-tight truncate">
                        {habit.name}
                      </h3>
                      <p className="text-sm font-bold text-muted-foreground">
                        {habit.completions.length} {habit.completions.length === 1 ? "day" : "days"}
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {habit.completions.map((c) => (
                      <li
                        key={c.completedDate}
                        className="flex items-start gap-3 p-3 rounded-xl border-2 border-border bg-muted/40"
                      >
                        <div className="text-2xl leading-none w-7 text-center pt-0.5">
                          {c.mood ? MOOD_EMOJI[c.mood] ?? "✓" : "✓"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-black uppercase text-sm tracking-wide">
                            {dayLabel(c.completedDate)}
                          </div>
                          {c.note ? (
                            <p className="mt-1 text-sm font-medium text-foreground/80 break-words whitespace-pre-wrap">
                              {c.note}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
