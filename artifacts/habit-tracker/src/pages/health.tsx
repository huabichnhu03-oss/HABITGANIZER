import React, { useEffect, useMemo, useState } from "react";
import {
  useGetHealthSummary,
  useCreateHealthEntry,
  useUpdateHealthEntry,
  useDeleteHealthEntry,
  useUpdateHealthGoals,
  getGetHealthSummaryQueryKey,
  type HealthMetric,
  type HealthMetricSummary,
  type HealthEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Flame,
  Moon,
  ArrowUpFromLine,
  Heart,
  Plus,
  X,
  Pencil,
  Trash2,
  Target,
  Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const METRIC_ORDER: HealthMetric[] = ["steps", "kcal", "sleep", "standups", "heart_rate"];

type MetricDetail = {
  /** Icon chip behind the metric glyph */
  iconBg: string;
  iconFg: string;
  /** + Log button (falls back to white if omitted) */
  plusBtn?: string;
  /** 7-day bar chart */
  chartMuted: string;
  chartToday: string;
  /** Goal progress track + fill */
  progressTrack: string;
  progressFill: string;
  /** “Today’s entries” panel */
  entriesWrap: string;
  entriesHeader: string;
  entriesHeaderFg: string;
  /** Small icon in Set Goals dialog (on meta.bg) */
  goalRowIconFg: string;
};

type MetricMeta = {
  label: string;
  short: string;
  unit: string;
  inputStep: number;
  bg: string;
  fg: string;
  detail: MetricDetail;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; fill?: string }>;
  formatValue: (n: number) => string;
  goalLabel: string;
  goalUnit: string;
  defaultGoal: number;
  isLatest?: boolean;
};

const META: Record<HealthMetric, MetricMeta> = {
  steps: {
    label: "Steps",
    short: "Steps",
    unit: "steps",
    inputStep: 1,
    bg: "bg-primary",
    fg: "text-white",
    detail: {
      iconBg: "bg-accent",
      iconFg: "text-accent-foreground",
      plusBtn: "bg-secondary text-secondary-foreground",
      chartMuted: "bg-primary-foreground/30",
      chartToday: "bg-secondary",
      progressTrack: "bg-primary-foreground/35",
      progressFill: "bg-accent",
      entriesWrap: "bg-card text-card-foreground border-brutal-sm",
      entriesHeader: "bg-accent/95 border-b-[3px] border-foreground/15",
      entriesHeaderFg: "text-accent-foreground",
      goalRowIconFg: "text-primary-foreground",
    },
    Icon: Activity,
    formatValue: (n) => Math.round(n).toLocaleString(),
    goalLabel: "Daily steps goal",
    goalUnit: "steps",
    defaultGoal: 10000,
  },
  kcal: {
    label: "Active Calories",
    short: "kcal",
    unit: "kcal",
    inputStep: 1,
    bg: "bg-secondary",
    fg: "text-foreground",
    detail: {
      iconBg: "bg-primary",
      iconFg: "text-primary-foreground",
      chartMuted: "bg-card/80",
      chartToday: "bg-primary",
      progressTrack: "bg-card/85",
      progressFill: "bg-primary",
      entriesWrap: "bg-card text-card-foreground border-brutal-sm",
      entriesHeader: "bg-primary/12 border-b-[3px] border-primary/25",
      entriesHeaderFg: "text-primary",
      goalRowIconFg: "text-foreground",
    },
    Icon: Flame,
    formatValue: (n) => Math.round(n).toLocaleString(),
    goalLabel: "Daily kcal goal",
    goalUnit: "kcal",
    defaultGoal: 500,
  },
  sleep: {
    label: "Sleep",
    short: "Sleep",
    unit: "hr",
    inputStep: 0.25,
    bg: "bg-[#7fc66c]",
    fg: "text-foreground",
    detail: {
      iconBg: "bg-accent",
      iconFg: "text-accent-foreground",
      chartMuted: "bg-card/70",
      chartToday: "bg-primary",
      progressTrack: "bg-card/75",
      progressFill: "bg-primary",
      entriesWrap: "bg-card text-card-foreground border-brutal-sm",
      entriesHeader: "bg-secondary/50 border-b-[3px] border-foreground/15",
      entriesHeaderFg: "text-foreground",
      goalRowIconFg: "text-foreground",
    },
    Icon: Moon,
    formatValue: formatHours,
    goalLabel: "Nightly sleep goal",
    goalUnit: "hr",
    defaultGoal: 8,
  },
  standups: {
    label: "Stand-ups",
    short: "Stand",
    unit: "hr",
    inputStep: 1,
    bg: "bg-accent",
    fg: "text-foreground",
    detail: {
      iconBg: "bg-primary",
      iconFg: "text-primary-foreground",
      chartMuted: "bg-card/75",
      chartToday: "bg-primary",
      progressTrack: "bg-card/80",
      progressFill: "bg-primary",
      entriesWrap: "bg-card text-card-foreground border-brutal-sm",
      entriesHeader: "bg-secondary/45 border-b-[3px] border-foreground/15",
      entriesHeaderFg: "text-foreground",
      goalRowIconFg: "text-foreground",
    },
    Icon: ArrowUpFromLine,
    formatValue: (n) => Math.round(n).toString(),
    goalLabel: "Daily stand-up hours",
    goalUnit: "hr",
    defaultGoal: 12,
  },
  heart_rate: {
    label: "Heart Rate",
    short: "HR",
    unit: "bpm",
    inputStep: 1,
    bg: "bg-secondary",
    fg: "text-foreground",
    detail: {
      iconBg: "bg-card",
      iconFg: "text-destructive",
      chartMuted: "bg-card/80",
      chartToday: "bg-primary",
      progressTrack: "bg-card/80",
      progressFill: "bg-primary",
      entriesWrap: "bg-card text-card-foreground border-brutal-sm",
      entriesHeader: "bg-primary/10 border-b-[3px] border-primary/20",
      entriesHeaderFg: "text-primary",
      goalRowIconFg: "text-foreground",
    },
    Icon: Heart,
    formatValue: (n) => `${Math.round(n)} bpm`,
    goalLabel: "Resting target",
    goalUnit: "bpm",
    defaultGoal: 70,
    isLatest: true,
  },
};

function formatHours(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0h";
  const h = Math.floor(n);
  const m = Math.round((n - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dayLabel(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString([], { weekday: "short" })[0]!;
}

export function HealthPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch } = useGetHealthSummary();
  const createEntry = useCreateHealthEntry();
  const updateEntry = useUpdateHealthEntry();
  const deleteEntry = useDeleteHealthEntry();
  const updateGoals = useUpdateHealthGoals();

  const [logFor, setLogFor] = useState<HealthMetric | null>(null);
  const [editEntry, setEditEntry] = useState<{ entry: HealthEntry; metric: HealthMetric } | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const summaryByMetric = useMemo(() => {
    const m = new Map<HealthMetric, HealthMetricSummary>();
    data?.metrics.forEach((s) => m.set(s.metric, s));
    return m;
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetHealthSummaryQueryKey() });

  const onSubmitEntry = (metric: HealthMetric, value: number) => {
    createEntry.mutate(
      { data: { metric, value } },
      {
        onSuccess: () => {
          toast({ title: `${META[metric].label} logged`, description: `Added ${META[metric].formatValue(value)}` });
          setLogFor(null);
          invalidate();
        },
        onError: () => toast({ title: "Couldn't log entry", variant: "destructive" }),
      },
    );
  };

  const onUpdateEntry = (id: number, value: number) => {
    updateEntry.mutate(
      { id, data: { value } },
      {
        onSuccess: () => {
          toast({ title: "Updated" });
          setEditEntry(null);
          invalidate();
        },
        onError: () => toast({ title: "Couldn't update", variant: "destructive" }),
      },
    );
  };

  const onDeleteEntry = (id: number) => {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
        },
        onError: () => toast({ title: "Couldn't delete", variant: "destructive" }),
      },
    );
  };

  const onSaveGoals = (next: Record<HealthMetric, number>) => {
    updateGoals.mutate(
      { data: { goals: METRIC_ORDER.map((m) => ({ metric: m, goal: next[m] })) } },
      {
        onSuccess: () => {
          toast({ title: "Goals saved" });
          setGoalsOpen(false);
          invalidate();
        },
        onError: () => toast({ title: "Couldn't save goals", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="bg-primary text-white p-6 rounded-3xl border-brutal shadow-brutal flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 fill-secondary text-secondary" strokeWidth={3} />
            <h1 className="text-4xl font-black uppercase tracking-tighter">Health</h1>
          </div>
          <p className="font-bold text-lg mt-2 opacity-90">
            Log steps, calories, sleep, stand-ups & heart rate. Track your week, hit your goals.
          </p>
        </div>
        <button
          data-testid="open-goals"
          onClick={() => setGoalsOpen(true)}
          className="hidden sm:flex shrink-0 items-center gap-2 bg-white text-foreground px-3 py-2 rounded-xl border-brutal-sm shadow-brutal-sm font-black uppercase text-sm hover:translate-y-0.5 hover:shadow-none transition-all"
        >
          <Settings className="w-4 h-4" strokeWidth={3} /> Goals
        </button>
      </header>

      <div className="sm:hidden">
        <button
          data-testid="open-goals-mobile"
          onClick={() => setGoalsOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-white text-foreground py-3 rounded-2xl border-brutal-sm shadow-brutal-sm font-black uppercase"
        >
          <Settings className="w-4 h-4" strokeWidth={3} /> Edit Goals
        </button>
      </div>

      {isError ? (
        <div
          className="bg-card border-brutal shadow-brutal rounded-3xl p-8 text-center"
          data-testid="health-error"
        >
          <p className="font-black text-lg mb-2">Couldn't load your health data</p>
          <p className="text-sm text-muted-foreground mb-4">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-5 py-2 bg-primary text-primary-foreground border-brutal shadow-brutal-sm rounded-xl font-black uppercase tracking-wide"
            data-testid="health-retry"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid sm:grid-cols-2 gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-64 bg-muted border-brutal shadow-brutal rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {METRIC_ORDER.map((metric) => {
            const s = summaryByMetric.get(metric);
            if (!s) return null;
            return (
              <MetricCard
                key={metric}
                metric={metric}
                summary={s}
                onLog={() => setLogFor(metric)}
                onEdit={(e) => setEditEntry({ entry: e, metric })}
                onDelete={onDeleteEntry}
              />
            );
          })}
        </div>
      )}

      {logFor && (
        <EntryDialog
          metric={logFor}
          title={`Log ${META[logFor].label}`}
          submitLabel="Log"
          isPending={createEntry.isPending}
          onClose={() => setLogFor(null)}
          onSubmit={(v) => onSubmitEntry(logFor, v)}
        />
      )}

      {editEntry && (
        <EntryDialog
          metric={editEntry.metric}
          title={`Edit ${META[editEntry.metric].label}`}
          submitLabel="Save"
          initialValue={editEntry.entry.value}
          isPending={updateEntry.isPending}
          onClose={() => setEditEntry(null)}
          onSubmit={(v) => onUpdateEntry(editEntry.entry.id, v)}
        />
      )}

      {goalsOpen && (
        <GoalsDialog
          initial={Object.fromEntries(
            METRIC_ORDER.map((m) => [m, summaryByMetric.get(m)?.goal ?? META[m].defaultGoal]),
          ) as Record<HealthMetric, number>}
          isPending={updateGoals.isPending}
          onClose={() => setGoalsOpen(false)}
          onSave={onSaveGoals}
        />
      )}
    </div>
  );
}

function MetricCard({
  metric,
  summary,
  onLog,
  onEdit,
  onDelete,
}: {
  metric: HealthMetric;
  summary: HealthMetricSummary;
  onLog: () => void;
  onEdit: (entry: HealthEntry) => void;
  onDelete: (id: number) => void;
}) {
  const meta = META[metric];
  const d = meta.detail;
  const Icon = meta.Icon;
  const goalPct = meta.isLatest
    ? summary.today > 0
      ? 100
      : 0
    : summary.goal > 0
    ? Math.min(100, Math.round((summary.today / summary.goal) * 100))
    : 0;

  const maxBar = Math.max(
    1,
    summary.goal,
    ...summary.history.map((p) => p.value),
  );

  return (
    <div
      data-testid={`metric-card-${metric}`}
      className={cn("brutal-card p-5 flex flex-col gap-4", meta.bg, meta.fg)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-12 h-12 rounded-xl border-brutal-sm shadow-brutal-sm flex items-center justify-center",
              d.iconBg,
            )}
          >
            <Icon className={cn("w-6 h-6", d.iconFg)} strokeWidth={3} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider opacity-80">{meta.short}</p>
            <h2 className="text-xl font-black uppercase tracking-tight">{meta.label}</h2>
          </div>
        </div>
        <button
          data-testid={`log-${metric}`}
          onClick={onLog}
          className={cn(
            "p-2 rounded-xl border-brutal-sm shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none transition-all",
            d.plusBtn ?? "bg-card text-card-foreground",
          )}
          aria-label={`Log ${meta.label}`}
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
        </button>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span data-testid={`value-${metric}`} className="text-4xl font-black tracking-tight">
            {meta.formatValue(summary.today)}
          </span>
          {!meta.isLatest && (
            <span className="text-sm font-bold opacity-80">
              / {meta.formatValue(summary.goal)}
            </span>
          )}
        </div>
        {meta.isLatest && summary.todayCount > 0 && summary.todayMin != null && summary.todayMax != null && summary.todayAvg != null ? (
          <p className="text-xs font-bold uppercase opacity-80 mt-1">
            min {Math.round(summary.todayMin)} · avg {Math.round(summary.todayAvg)} · max {Math.round(summary.todayMax)} bpm
          </p>
        ) : meta.isLatest ? (
          <p className="text-xs font-bold uppercase opacity-80 mt-1">No reading yet today</p>
        ) : (
          <div className={cn("mt-2 h-3 rounded-full border-brutal-sm overflow-hidden", d.progressTrack)}>
            <div className={cn("h-full", d.progressFill)} style={{ width: `${goalPct}%` }} />
          </div>
        )}
      </div>

      {/* 7-day history */}
      <div>
        <div className="flex items-end justify-between gap-1 h-16">
          {summary.history.map((p) => {
            const pct = maxBar > 0 ? Math.max(p.value > 0 ? 8 : 2, Math.round((p.value / maxBar) * 100)) : 2;
            const isToday = p.date === summary.history[summary.history.length - 1]?.date;
            return (
              <div key={p.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    data-testid={`bar-${metric}-${p.date}`}
                    title={`${p.date}: ${meta.formatValue(p.value)}`}
                    className={cn(
                      "w-full rounded-t-md border-brutal-sm",
                      isToday ? d.chartToday : d.chartMuted,
                    )}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-black uppercase opacity-70">{dayLabel(p.date)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's entries */}
      {summary.entries.length > 0 && (
        <div className={cn("rounded-2xl overflow-hidden", d.entriesWrap)}>
          <div className={cn("px-3 py-2", d.entriesHeader)}>
            <p className={cn("text-xs font-black uppercase tracking-wider", d.entriesHeaderFg)}>
              Today's Entries · {summary.entries.length}
            </p>
          </div>
          <ul className="divide-y-[3px] divide-foreground/12">
            {summary.entries.map((e) => (
              <li
                key={e.id}
                data-testid={`entry-${metric}-${e.id}`}
                className="flex items-center justify-between px-3 py-2 gap-2"
              >
                <div className="min-w-0">
                  <p className="font-black tabular-nums">{meta.formatValue(e.value)}</p>
                  <p className="text-[10px] font-bold uppercase opacity-70">{formatTime(e.recordedAt)}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    data-testid={`edit-${metric}-${e.id}`}
                    onClick={() => onEdit(e)}
                    className="p-1.5 rounded-md border-2 border-foreground bg-card hover:bg-accent/80 transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                  <button
                    data-testid={`delete-${metric}-${e.id}`}
                    onClick={() => onDelete(e.id)}
                    className="p-1.5 rounded-md border-2 border-foreground bg-card hover:bg-destructive/25 transition-colors"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={3} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EntryDialog({
  metric,
  title,
  submitLabel,
  initialValue,
  isPending,
  onClose,
  onSubmit,
}: {
  metric: HealthMetric;
  title: string;
  submitLabel: string;
  initialValue?: number;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
}) {
  const meta = META[metric];
  const [value, setValue] = useState<string>(initialValue !== undefined ? String(initialValue) : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return;
    onSubmit(n);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-card border-brutal shadow-brutal rounded-3xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        data-testid="entry-dialog"
      >
        <div className="flex items-center justify-between p-4 border-b-[3px] border-foreground">
          <h2 className="text-xl font-black uppercase tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            data-testid="close-entry-dialog"
            className="p-2 rounded-xl border-brutal-sm bg-card hover:bg-destructive/20"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <label className="block text-xs font-black uppercase tracking-wider">
            Value ({meta.unit})
          </label>
          <input
            data-testid="entry-value-input"
            autoFocus
            type="number"
            inputMode="decimal"
            step={meta.inputStep}
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full text-2xl font-black tabular-nums px-4 py-3 rounded-xl bg-white border-brutal-sm focus:outline-none focus:shadow-brutal-sm"
            placeholder="0"
          />
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted border-brutal-sm font-black uppercase hover:translate-y-0.5 transition-transform"
            >
              Cancel
            </button>
            <button
              data-testid="submit-entry"
              onClick={submit}
              disabled={isPending || value === ""}
              className="flex-1 py-3 rounded-xl bg-primary text-white border-brutal-sm shadow-brutal-sm font-black uppercase disabled:opacity-60 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              {isPending ? "..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalsDialog({
  initial,
  isPending,
  onClose,
  onSave,
}: {
  initial: Record<HealthMetric, number>;
  isPending: boolean;
  onClose: () => void;
  onSave: (next: Record<HealthMetric, number>) => void;
}) {
  const [values, setValues] = useState<Record<HealthMetric, string>>(() =>
    Object.fromEntries(METRIC_ORDER.map((m) => [m, String(initial[m])])) as Record<HealthMetric, string>,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    const next: Record<HealthMetric, number> = { ...initial };
    let valid = true;
    for (const m of METRIC_ORDER) {
      const n = Number(values[m]);
      if (!Number.isFinite(n) || n <= 0) {
        valid = false;
        break;
      }
      next[m] = n;
    }
    if (!valid) return;
    onSave(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-card border-brutal shadow-brutal rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        data-testid="goals-dialog"
      >
        <div className="flex items-center justify-between p-4 border-b-[3px] border-foreground sticky top-0 bg-card">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5" strokeWidth={3} />
            <h2 className="text-xl font-black uppercase tracking-tight">Set Goals</h2>
          </div>
          <button
            onClick={onClose}
            data-testid="close-goals-dialog"
            className="p-2 rounded-xl border-brutal-sm bg-card hover:bg-destructive/20"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {METRIC_ORDER.map((m) => {
            const meta = META[m];
            const Icon = meta.Icon;
            return (
              <div key={m} className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl border-brutal-sm flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon className={cn("w-5 h-5", meta.detail.goalRowIconFg)} strokeWidth={3} />
                </div>
                <label className="flex-1">
                  <p className="text-xs font-black uppercase tracking-wider">{meta.goalLabel}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      data-testid={`goal-input-${m}`}
                      type="number"
                      inputMode="decimal"
                      step={meta.inputStep}
                      min={0}
                      value={values[m]}
                      onChange={(e) => setValues((v) => ({ ...v, [m]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-xl bg-white border-brutal-sm font-black tabular-nums focus:outline-none focus:shadow-brutal-sm"
                    />
                    <span className="text-xs font-black uppercase opacity-70 w-10">{meta.goalUnit}</span>
                  </div>
                </label>
              </div>
            );
          })}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-muted border-brutal-sm font-black uppercase hover:translate-y-0.5 transition-transform"
            >
              Cancel
            </button>
            <button
              data-testid="save-goals"
              onClick={submit}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl bg-primary text-white border-brutal-sm shadow-brutal-sm font-black uppercase disabled:opacity-60 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              {isPending ? "..." : "Save Goals"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
