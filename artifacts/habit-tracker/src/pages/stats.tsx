import React, { useMemo } from "react";
import { useGetDashboard, useListHabits } from "@workspace/api-client-react";
import { DynamicIcon, getHabitColor, getReadableForeground } from "@/components/icons";
import { Flame, Trophy, Calendar, CheckCircle2, TrendingUp, Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";
import { CalendarOverviewSection } from "@/components/calendar-overview";

export function StatsPage() {
  const dashboardQuery = useGetDashboard();
  const habitsQuery = useListHabits();
  const { data: dashboard } = dashboardQuery;
  const { data: habits } = habitsQuery;

  // Hooks must run on every render in the same order — keep useMemo above
  // any early `return` statements (Rules of Hooks).
  const habitRows = useMemo(() => {
    if (!dashboard || !habits) return [];
    const byId = new Map(habits.map((h, i) => [h.id, { habit: h, index: i }]));
    return dashboard.habitStats.map((stat, i) => {
      const lookup = byId.get(stat.habitId);
      const colorDef = getHabitColor(lookup?.habit, lookup?.index ?? i);
      return { stat, colorDef };
    });
  }, [dashboard, habits]);

  if (dashboardQuery.isError || habitsQuery.isError) {
    return (
      <div className="space-y-8">
        <ApiQueryErrorBanner
          title="Couldn’t load stats"
          onRetry={() => {
            void dashboardQuery.refetch();
            void habitsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!dashboard || !habits) {
    return (
      <div className="space-y-8">
        <div className="h-12 w-64 bg-muted border-brutal shadow-brutal rounded-2xl animate-pulse" />
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-muted border-brutal shadow-brutal rounded-[2rem] animate-pulse" />)}
        </div>
        <div className="h-96 bg-muted border-brutal shadow-brutal rounded-[2rem] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Star className="w-10 h-10 fill-accent text-foreground drop-shadow-[2px_2px_0_rgba(0,0,0,1)] -rotate-6" />
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">Stats & Flex</h1>
        </div>
      </header>

      {/* Top Level Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <div className="brutal-card bg-primary text-white p-3 sm:p-6 flex flex-col justify-between min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-brutal-sm shadow-brutal-sm flex items-center justify-center mb-3 sm:mb-6">
            <CheckCircle2 className="w-5 h-5 sm:w-8 sm:h-8 text-foreground" strokeWidth={3} />
          </div>
          <p className="text-xs sm:text-lg font-bold uppercase">Today</p>
          <h2 className="text-2xl sm:text-5xl font-black">{Math.round(dashboard.todayCompletionRate * 100)}%</h2>
        </div>

        <div className="brutal-card bg-accent text-foreground p-3 sm:p-6 flex flex-col justify-between min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-brutal-sm shadow-brutal-sm flex items-center justify-center mb-3 sm:mb-6">
            <Flame className="w-5 h-5 sm:w-8 sm:h-8 fill-orange-500 text-orange-500" strokeWidth={3} />
          </div>
          <p className="text-xs sm:text-lg font-bold uppercase">Best Streak</p>
          <div className="flex items-baseline gap-1 sm:gap-2 flex-wrap">
            <h2 className="text-2xl sm:text-5xl font-black">{dashboard.longestActiveStreak}</h2>
            <span className="text-xs sm:text-xl font-bold">days</span>
          </div>
        </div>

        <div className="brutal-card bg-secondary text-foreground p-3 sm:p-6 flex flex-col justify-between min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-brutal-sm shadow-brutal-sm flex items-center justify-center mb-3 sm:mb-6">
            <Calendar className="w-5 h-5 sm:w-8 sm:h-8 text-foreground" strokeWidth={3} />
          </div>
          <p className="text-xs sm:text-lg font-bold uppercase">Weekly Avg</p>
          <h2 className="text-2xl sm:text-5xl font-black">{Math.round(dashboard.weeklyCompletionRate * 100)}%</h2>
        </div>

        <div className="brutal-card bg-white text-foreground p-3 sm:p-6 flex flex-col justify-between min-w-0">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-accent border-brutal-sm shadow-brutal-sm flex items-center justify-center mb-3 sm:mb-6">
            <Trophy className="w-5 h-5 sm:w-8 sm:h-8 text-foreground" strokeWidth={3} />
          </div>
          <p className="text-xs sm:text-lg font-bold uppercase">Total Habits</p>
          <h2 className="text-2xl sm:text-5xl font-black">{dashboard.totalHabits}</h2>
        </div>
      </div>

      {/* Habit Breakdown */}
      <div>
        <h2 className="text-3xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-foreground" strokeWidth={3} /> Scoreboard
        </h2>
        <div className="brutal-card bg-white overflow-hidden p-0 max-w-full">
          <table className="w-full max-w-full text-left border-collapse table-fixed">
            <thead className="bg-foreground text-white border-b-brutal">
              <tr>
                <th className="px-2 sm:px-6 py-3 sm:py-5 font-black uppercase tracking-tight sm:tracking-widest text-xs sm:text-base">Habit</th>
                <th className="px-1 sm:px-6 py-3 sm:py-5 font-black uppercase tracking-tight sm:tracking-widest text-xs sm:text-base w-[60px] sm:w-auto">Streak</th>
                <th className="px-2 sm:px-6 py-5 font-black uppercase tracking-widest hidden sm:table-cell">Best</th>
                <th className="px-2 sm:px-6 py-5 font-black uppercase tracking-widest hidden md:table-cell">Total Done</th>
                <th className="px-2 sm:px-6 py-3 sm:py-5 font-black uppercase tracking-tight sm:tracking-widest text-xs sm:text-base text-right w-[80px] sm:w-auto">Weekly</th>
              </tr>
            </thead>
            <tbody className="text-sm sm:text-lg font-bold">
              {habitRows.map(({ stat, colorDef }, i) => {
                const isLast = i === habitRows.length - 1;
                return (
                  <tr key={stat.habitId} className={`hover:bg-muted/50 transition-colors ${!isLast ? 'border-b-[3px] border-border' : ''}`}>
                    <td className="px-2 sm:px-6 py-3 sm:py-5">
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <div
                          className="w-7 h-7 sm:w-12 sm:h-12 shrink-0 rounded-lg sm:rounded-xl flex items-center justify-center border-brutal-sm shadow-brutal-sm"
                          style={{ backgroundColor: colorDef.hex, color: getReadableForeground(colorDef.hex) }}
                        >
                          <DynamicIcon name={stat.icon} className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={3} />
                        </div>
                        <span className="font-black uppercase tracking-tight text-xs sm:text-xl truncate min-w-0">{stat.name}</span>
                      </div>
                    </td>
                    <td className="px-1 sm:px-6 py-3 sm:py-5">
                      <div className="flex items-center gap-1 sm:gap-2">
                        {stat.currentStreak > 0 ? (
                          <><Flame className="w-4 h-4 sm:w-6 sm:h-6 fill-orange-500 text-orange-500 shrink-0" /> <span className="font-black text-base sm:text-2xl">{stat.currentStreak}</span></>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 sm:px-6 py-5 hidden sm:table-cell">{stat.longestStreak}</td>
                    <td className="px-2 sm:px-6 py-5 hidden md:table-cell">{stat.totalCompletions}</td>
                    <td className="px-2 sm:px-6 py-3 sm:py-5">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1 sm:gap-3">
                        <span className="font-black text-xs sm:text-xl whitespace-nowrap">{stat.weeklyCompletions}/7</span>
                        <div className="w-10 sm:w-24 h-2 sm:h-4 bg-muted rounded-full border-2 border-border overflow-hidden shadow-inner">
                          <div className={`h-full border-r-2 border-border ${colorDef.tailwind}`} style={{ width: `${(stat.weeklyCompletions/7)*100}%`, backgroundColor: colorDef.hex }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {habitRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xl font-bold">No habits created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CalendarOverviewSection />
    </div>
  );
}
