import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  useListHabits,
  useCompleteHabit,
  useUncompleteHabit,
  useUpdateCompletion,
  getListHabitsQueryKey,
  getGetDashboardQueryKey,
  getGetWalletQueryKey,
  HabitMood,
  type Habit,
} from "@workspace/api-client-react";
import { localCalendarDateString } from "@workspace/habit-dates";
import { useQueryClient } from "@tanstack/react-query";
import { DynamicIcon, getHabitColor, getReadableForeground } from "@/components/icons";
import { Check, Flame, Star, X, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";
import { GroceryList } from "@/components/grocery-list";

const NOTE_MAX = 280;

const MOOD_OPTIONS: ReadonlyArray<{ value: HabitMood; emoji: string; label: string }> = [
  { value: "great", emoji: "😀", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "meh", emoji: "😕", label: "Meh" },
  { value: "bad", emoji: "😞", label: "Bad" },
];

const MOOD_EMOJI: Record<HabitMood, string> = {
  great: "😀",
  good: "🙂",
  okay: "😐",
  meh: "😕",
  bad: "😞",
};

/** Local YYYY-MM-DD — must match API `habitCalendarToday` when `X-Habit-Calendar-Timezone` is sent. Call at action time (not once on mount). */
function calendarTodayForActions(): string {
  return localCalendarDateString();
}

type CompleteCtx = { previous: Habit[] | undefined; previousDashboard: unknown };
type UpdateCtx = { previous: Habit[] | undefined };

export function TodayPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const todayWeekday = useMemo(() => format(new Date(), "EEE").toLowerCase(), []);
  const dateLabels = useMemo(
    () => ({
      weekday: format(new Date(), "EEEE"),
      pretty: format(new Date(), "MMMM do, yyyy"),
    }),
    [],
  );

  const habitsKey = useMemo(() => getListHabitsQueryKey(), []);
  const dashboardKey = useMemo(() => getGetDashboardQueryKey(), []);

  const { data: habits, isError, error, refetch } = useListHabits();

  const patchHabit = useCallback(
    (habitId: number, patch: Partial<Habit>) => {
      queryClient.setQueryData<Habit[]>(habitsKey, (old) =>
        old?.map((h) => (h.id === habitId ? { ...h, ...patch } : h)),
      );
    },
    [queryClient, habitsKey],
  );

  const patchDashboardCompletion = useCallback(
    (habitId: number, completed: boolean) => {
      queryClient.setQueryData<{
        completedToday: number;
        totalHabits: number;
        todayCompletionRate: number;
        habitStats: Array<{ habitId: number; completedToday: boolean } & Record<string, unknown>>;
      } & Record<string, unknown>>(dashboardKey, (old) => {
        if (!old) return old;
        const stats = (old.habitStats ?? []).map((s) =>
          s.habitId === habitId ? { ...s, completedToday: completed } : s,
        );
        const completedToday = stats.filter((s) => s.completedToday).length;
        return {
          ...old,
          habitStats: stats,
          completedToday,
          todayCompletionRate: old.totalHabits > 0 ? completedToday / old.totalHabits : 0,
        };
      });
    },
    [queryClient, dashboardKey],
  );

  const completeHabit = useCompleteHabit<Error, CompleteCtx>({
    mutation: {
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: habitsKey }),
          queryClient.cancelQueries({ queryKey: dashboardKey }),
        ]);
        const previous = queryClient.getQueryData<Habit[]>(habitsKey);
        const previousDashboard = queryClient.getQueryData(dashboardKey);
        patchHabit(id, { completedToday: true });
        patchDashboardCompletion(id, true);
        return { previous, previousDashboard };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        if (ctx?.previousDashboard !== undefined) queryClient.setQueryData(dashboardKey, ctx.previousDashboard);
        toast({ title: "Couldn’t mark complete", description: "Please try again." });
      },
      onSuccess: (res, vars) => {
        // Sync with server response (mood/note may have been written too).
        patchHabit(vars.id, {
          completedToday: true,
          todayMood: res.completion.mood ?? null,
          todayNote: res.completion.note ?? null,
        });
        if (res.coinsAwarded > 0) {
          const reward: string[] = [`+${res.coinsAwarded} coins`];
          if (res.foodAwarded > 0) reward.push(`+${res.foodAwarded} food`);
          if (res.waterAwarded > 0) reward.push(`+${res.waterAwarded} water`);
          toast({
            title: `${reward.join(" · ")} 🎉`,
            description: `Wallet: ${res.wallet.coins} coins · ${res.wallet.food} food · ${res.wallet.water} water.`,
          });
          // Wallet/dashboard need refresh only when something was actually awarded.
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
      },
    },
  });

  const uncompleteHabit = useUncompleteHabit<Error, CompleteCtx>({
    mutation: {
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: habitsKey }),
          queryClient.cancelQueries({ queryKey: dashboardKey }),
        ]);
        const previous = queryClient.getQueryData<Habit[]>(habitsKey);
        const previousDashboard = queryClient.getQueryData(dashboardKey);
        patchHabit(id, { completedToday: false, todayMood: null, todayNote: null });
        patchDashboardCompletion(id, false);
        return { previous, previousDashboard };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        if (ctx?.previousDashboard !== undefined) queryClient.setQueryData(dashboardKey, ctx.previousDashboard);
        toast({ title: "Couldn’t remove completion", description: "Please try again." });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });

  const updateCompletion = useUpdateCompletion<Error, UpdateCtx>({
    mutation: {
      onMutate: async ({ id, data }) => {
        await queryClient.cancelQueries({ queryKey: habitsKey });
        const previous = queryClient.getQueryData<Habit[]>(habitsKey);
        const patch: Partial<Habit> = {};
        if (data.mood !== undefined) patch.todayMood = data.mood ?? null;
        if (data.note !== undefined) patch.todayNote = data.note ?? null;
        patchHabit(id, patch);
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        toast({ title: "Couldn’t save", description: "Please try again." });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
      },
    },
  });

  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetHabit = useMemo(
    () => (sheetHabitId == null ? null : habits?.find((h) => h.id === sheetHabitId) ?? null),
    [sheetHabitId, habits],
  );
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Tracks in-flight POST /complete promises so Save/Remove can await them
  // and avoid PATCH/DELETE racing ahead of the initial creation.
  const inFlightCompleteRef = useRef<Map<number, Promise<unknown>>>(new Map());

  const openSheetFor = useCallback((habit: Habit) => {
    if (!habit.completedToday) {
      const p = completeHabit.mutateAsync({ id: habit.id, data: { date: calendarTodayForActions() } });
      // Swallow rejection here; completeHabit's own onError already rolls back + toasts.
      const tracked = p.catch(() => "__failed__" as const);
      inFlightCompleteRef.current.set(habit.id, tracked);
      tracked.then(() => {
        if (inFlightCompleteRef.current.get(habit.id) === tracked) {
          inFlightCompleteRef.current.delete(habit.id);
        }
      });
    }
    setSheetHabitId(habit.id);
    setSheetOpen(true);
  }, [completeHabit]);

  const handleSave = useCallback(
    (mood: HabitMood | null, note: string | null) => {
      if (sheetHabitId == null) return;
      const id = sheetHabitId;
      setSheetOpen(false);
      const inFlight = inFlightCompleteRef.current.get(id);
      const fire = (val?: unknown) => {
        // Skip if the initial complete failed — the row doesn't exist on the server.
        if (val === "__failed__") return;
        updateCompletion.mutate({ id, data: { date: calendarTodayForActions(), mood, note } });
      };
      if (inFlight) inFlight.then(fire, () => {});
      else fire();
    },
    [sheetHabitId, updateCompletion],
  );

  const handleRemove = useCallback(() => {
    if (sheetHabitId == null) return;
    const id = sheetHabitId;
    setSheetOpen(false);
    const inFlight = inFlightCompleteRef.current.get(id);
    const fire = (val?: unknown) => {
      // Skip if the initial complete failed — there's nothing to delete.
      if (val === "__failed__") return;
      uncompleteHabit.mutate({ id, data: { date: calendarTodayForActions() } });
    };
    if (inFlight) inFlight.then(fire, () => {});
    else fire();
  }, [sheetHabitId, uncompleteHabit]);

  const activeHabits = useMemo(
    () => habits?.filter(h => h.targetDays.includes("all") || h.targetDays.includes(todayWeekday)) || [],
    [habits, todayWeekday],
  );
  const completedCount = useMemo(
    () => activeHabits.filter(h => h.completedToday).length,
    [activeHabits],
  );

  if (isError) {
    return (
      <div className="space-y-6">
        <ApiQueryErrorBanner title="Couldn’t load habits" onRetry={() => refetch()}>
          {error instanceof Error ? error.message : undefined}
        </ApiQueryErrorBanner>
      </div>
    );
  }

  if (!habits) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-muted border-brutal shadow-brutal rounded-2xl animate-pulse" />
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-muted border-brutal shadow-brutal rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <WelcomeGreeting />
      <TodayProgressHeader
        weekday={dateLabels.weekday}
        pretty={dateLabels.pretty}
        completed={completedCount}
        total={activeHabits.length}
      />

      {activeHabits.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border-brutal shadow-brutal">
          <Star className="w-20 h-20 fill-accent text-foreground mx-auto mb-6 drop-shadow-[4px_4px_0_rgba(0,0,0,1)]" />
          <h2 className="text-3xl font-black mb-4 uppercase tracking-tight">Free Day!</h2>
          <p className="text-xl font-bold">No habits scheduled for today. Enjoy the break!</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {activeHabits.map((habit, index) => {
            const colorDef = getHabitColor(habit, index);
            const isCompleted = habit.completedToday;
            const moodEmoji = habit.todayMood ? MOOD_EMOJI[habit.todayMood] : null;
            const fg = isCompleted ? undefined : getReadableForeground(colorDef.hex);

            return (
              <button
                key={habit.id}
                data-testid={`habit-toggle-${habit.id}`}
                onClick={() => openSheetFor(habit)}
                className={cn(
                  "group relative overflow-hidden flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl text-left transition-all duration-300 w-full brutal-card",
                  isCompleted
                    ? "bg-white opacity-80 translate-y-1 shadow-none"
                    : colorDef.tailwind
                )}
                style={isCompleted ? undefined : { backgroundColor: colorDef.hex, color: fg }}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all duration-300 border-brutal-sm",
                    isCompleted ? "bg-primary text-white shadow-brutal-sm" : "bg-white text-foreground shadow-brutal-sm group-hover:scale-110 group-active:scale-95"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 animate-in zoom-in duration-300" strokeWidth={4} />
                  ) : (
                    <DynamicIcon name={habit.icon} className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3
                      style={isCompleted ? undefined : { color: fg }}
                      className={cn(
                      "text-sm sm:text-base font-black uppercase tracking-tight transition-all duration-300 truncate",
                      isCompleted ? "text-muted-foreground line-through decoration-4 decoration-foreground" : ""
                    )}>
                      {habit.name}
                    </h3>
                    {moodEmoji && (
                      <span
                        className="text-base leading-none"
                        aria-label={`Mood: ${habit.todayMood}`}
                        data-testid={`habit-mood-${habit.id}`}
                      >
                        {moodEmoji}
                      </span>
                    )}
                  </div>
                  {habit.todayNote ? (
                    <p
                      style={isCompleted ? undefined : { color: fg, opacity: 0.85 }}
                      className={cn(
                        "text-xs font-bold truncate mt-0.5",
                        isCompleted ? "text-muted-foreground" : ""
                      )}
                      data-testid={`habit-note-${habit.id}`}
                    >
                      “{habit.todayNote}”
                    </p>
                  ) : habit.description && (
                    <p
                      style={isCompleted ? undefined : { color: fg, opacity: 0.85 }}
                      className={cn(
                      "text-xs font-bold truncate mt-0.5",
                      isCompleted ? "text-muted-foreground line-through" : ""
                    )}>
                      {habit.description}
                    </p>
                  )}
                </div>

                {habit.currentStreak > 0 && (
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black transition-all border-brutal-sm shadow-brutal-sm shrink-0",
                    isCompleted ? "bg-muted text-muted-foreground shadow-none translate-y-1" : "bg-white text-foreground rotate-3"
                  )}>
                    <Flame className="w-3 h-3 fill-orange-500 text-orange-500" />
                    <span>{habit.currentStreak}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <GroceryList />

      <MoodSheet
        open={sheetOpen}
        habit={sheetHabit}
        onClose={closeSheet}
        onSave={handleSave}
        onRemove={handleRemove}
      />
    </div>
  );
}

function TodayProgressHeader({
  weekday,
  pretty,
  completed,
  total,
}: {
  weekday: string;
  pretty: string;
  completed: number;
  total: number;
}) {
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed === total;

  return (
    <header className="bg-accent px-4 py-3 rounded-2xl border-brutal shadow-brutal-sm space-y-2">
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground uppercase tracking-tight truncate">
            {weekday}
          </h1>
          <p className="text-foreground/80 font-bold text-xs sm:text-sm truncate">{pretty}</p>
        </div>
        <span className="shrink-0 text-sm font-black tabular-nums" data-testid="today-progress-text">
          {completed}/{total}
        </span>
      </div>
      {total > 0 && (
        <div className="space-y-1">
          <div className="h-2.5 w-full bg-white/60 border-brutal-sm rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                allDone ? "bg-foreground" : "bg-primary",
              )}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={total}
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">
            {allDone ? "All habits done!" : `${progressPct}% complete`}
          </p>
        </div>
      )}
    </header>
  );
}

function WelcomeGreeting() {
  const { user } = useUser();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  const storedName =
    user.firstName || user.username || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "";

  const greetingLabel = storedName.trim() ? storedName : "Friend";

  const [draft, setDraft] = useState(storedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(storedName);
      // Focus next tick once input is mounted.
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [editing, storedName]);

  const save = async () => {
    try {
      await user.update({ firstName: draft });
      setEditing(false);
    } catch (err) {
      toast({
        title: "Couldn’t update name",
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  return (
    <div className="flex items-center gap-2 text-foreground" data-testid="welcome-greeting">
      <span className="text-lg font-black uppercase tracking-tight">Welcome,</span>
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={30}
            data-testid="welcome-input"
            className="px-2 py-1 border-brutal-sm rounded-lg bg-white text-lg font-black uppercase tracking-tight w-44 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={save}
            data-testid="welcome-save"
            className="px-3 py-1 border-brutal-sm rounded-lg bg-primary text-white text-xs font-black uppercase"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            data-testid="welcome-cancel"
            className="px-3 py-1 border-brutal-sm rounded-lg bg-white text-xs font-black uppercase"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="text-lg font-black uppercase tracking-tight" data-testid="welcome-username">
            {greetingLabel}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid="welcome-edit"
            aria-label="Edit username"
            className="ml-1 p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

interface MoodSheetProps {
  open: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSave: (mood: HabitMood | null, note: string | null) => void;
  onRemove: () => void;
}

function MoodSheet({ open, habit, onClose, onSave, onRemove }: MoodSheetProps) {
  const [mood, setMood] = useState<HabitMood | null>(null);
  const [note, setNote] = useState("");
  const lastHabitIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && habit && habit.id !== lastHabitIdRef.current) {
      setMood(habit.todayMood ?? null);
      setNote(habit.todayNote ?? "");
      lastHabitIdRef.current = habit.id;
    }
    if (!open) {
      lastHabitIdRef.current = null;
    }
  }, [open, habit]);

  const trimmedNote = note.slice(0, NOTE_MAX);
  const charsLeft = NOTE_MAX - trimmedNote.length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="border-brutal shadow-brutal rounded-3xl bg-white max-w-md p-0 gap-0"
        data-testid="mood-sheet"
      >
        <DialogHeader className="p-6 pb-3 border-b-2 border-foreground">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">
            {habit?.name ?? "Habit"}
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground/70">
            How did it feel? Add a quick note if you want.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2">Mood</p>
            <div className="flex justify-between gap-2" role="radiogroup" aria-label="Mood">
              {MOOD_OPTIONS.map((opt) => {
                const selected = mood === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={opt.label}
                    data-testid={`mood-option-${opt.value}`}
                    onClick={() => setMood(selected ? null : opt.value)}
                    className={cn(
                      "flex-1 aspect-square rounded-2xl border-brutal-sm flex items-center justify-center text-3xl transition-all",
                      selected
                        ? "bg-accent shadow-brutal-sm -translate-y-0.5"
                        : "bg-muted hover:bg-accent/40 active:translate-y-0.5",
                    )}
                  >
                    {opt.emoji}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black uppercase tracking-wider">Note</p>
              <span className={cn(
                "text-xs font-bold",
                charsLeft < 20 ? "text-destructive" : "text-foreground/60",
              )}>
                {charsLeft}
              </span>
            </div>
            <Textarea
              value={trimmedNote}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="Optional — e.g. felt energized, harder than usual…"
              maxLength={NOTE_MAX}
              data-testid="mood-note-input"
              className="border-brutal-sm rounded-2xl font-medium min-h-[88px] resize-none"
            />
          </div>
        </div>
        <div className="p-6 pt-2 flex flex-wrap gap-3 justify-end border-t-2 border-foreground/10">
          <Button
            variant="ghost"
            onClick={onRemove}
            data-testid="mood-remove"
            className="font-black uppercase tracking-tight text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Remove
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="mood-skip"
            className="border-brutal-sm rounded-xl font-black uppercase tracking-tight bg-white"
          >
            <X className="w-4 h-4 mr-1" /> Skip
          </Button>
          <Button
            onClick={() => onSave(mood, trimmedNote.trim() ? trimmedNote.trim() : null)}
            data-testid="mood-save"
            className="border-brutal-sm shadow-brutal-sm rounded-xl font-black uppercase tracking-tight bg-primary text-primary-foreground hover:bg-primary"
          >
            <Check className="w-4 h-4 mr-1" /> Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
