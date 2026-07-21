import { Feather } from "@expo/vector-icons";
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
import React, { memo, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";
import { syncHealthFromPhone } from "@/lib/healthConnectPhoneSync";

type ColorTokens = ReturnType<typeof useColors>;
type ColorKey = {
  [K in keyof ColorTokens]: ColorTokens[K] extends string ? K : never;
}[keyof ColorTokens];

const METRIC_ORDER: HealthMetric[] = ["steps", "kcal", "sleep", "standups", "heart_rate"];

type FeatherIcon = React.ComponentProps<typeof Feather>["name"];

interface MetricMeta {
  label: string;
  short: string;
  unit: string;
  inputStep: number;
  bg: ColorKey;
  Icon: FeatherIcon;
  defaultGoal: number;
  goalLabel: string;
  goalUnit: string;
  format: (n: number) => string;
  isLatest?: boolean;
  /** Accent colors for chart, entries strip, icon chip — matches web brand tokens */
  detail: {
    iconBoxBg: ColorKey;
    iconColor: ColorKey;
    plusBg: ColorKey;
    plusColor: ColorKey;
    barMuted: string;
    barToday: ColorKey;
    progressTrack: string;
    progressFill: ColorKey;
    entriesHeaderBg: string;
    entriesHeaderColor: ColorKey;
  };
}

const META: Record<HealthMetric, MetricMeta> = {
  steps: {
    label: "Steps",
    short: "Steps",
    unit: "steps",
    inputStep: 1,
    bg: "primary",
    Icon: "activity",
    defaultGoal: 10000,
    goalLabel: "Daily steps goal",
    goalUnit: "steps",
    format: (n) => Math.round(n).toLocaleString(),
    detail: {
      iconBoxBg: "accent",
      iconColor: "accentForeground",
      plusBg: "secondary",
      plusColor: "secondaryForeground",
      barMuted: "rgba(255,255,255,0.32)",
      barToday: "secondary",
      progressTrack: "rgba(255,255,255,0.38)",
      progressFill: "accent",
      entriesHeaderBg: "#f8d52af2",
      entriesHeaderColor: "accentForeground",
    },
  },
  kcal: {
    label: "Active Calories",
    short: "kcal",
    unit: "kcal",
    inputStep: 1,
    bg: "secondary",
    Icon: "zap",
    defaultGoal: 500,
    goalLabel: "Daily kcal goal",
    goalUnit: "kcal",
    format: (n) => Math.round(n).toLocaleString(),
    detail: {
      iconBoxBg: "primary",
      iconColor: "primaryForeground",
      plusBg: "card",
      plusColor: "foreground",
      barMuted: "rgba(255,255,255,0.62)",
      barToday: "primary",
      progressTrack: "rgba(255,255,255,0.72)",
      progressFill: "primary",
      entriesHeaderBg: "#4258d626",
      entriesHeaderColor: "primary",
    },
  },
  sleep: {
    label: "Sleep",
    short: "Sleep",
    unit: "hr",
    inputStep: 0.25,
    bg: "green",
    Icon: "moon",
    defaultGoal: 8,
    goalLabel: "Nightly sleep goal",
    goalUnit: "hr",
    format: formatHours,
    detail: {
      iconBoxBg: "accent",
      iconColor: "accentForeground",
      plusBg: "card",
      plusColor: "foreground",
      barMuted: "rgba(255,255,255,0.55)",
      barToday: "primary",
      progressTrack: "rgba(255,255,255,0.65)",
      progressFill: "primary",
      entriesHeaderBg: "#f5b8c8b0",
      entriesHeaderColor: "foreground",
    },
  },
  standups: {
    label: "Stand-ups",
    short: "Stand",
    unit: "hr",
    inputStep: 1,
    bg: "accent",
    Icon: "arrow-up",
    defaultGoal: 12,
    goalLabel: "Daily stand-up hours",
    goalUnit: "hr",
    format: (n) => Math.round(n).toString(),
    detail: {
      iconBoxBg: "primary",
      iconColor: "primaryForeground",
      plusBg: "card",
      plusColor: "foreground",
      barMuted: "rgba(255,255,255,0.58)",
      barToday: "primary",
      progressTrack: "rgba(255,255,255,0.72)",
      progressFill: "primary",
      entriesHeaderBg: "#f5b8c8a8",
      entriesHeaderColor: "foreground",
    },
  },
  heart_rate: {
    label: "Heart Rate",
    short: "HR",
    unit: "bpm",
    inputStep: 1,
    bg: "secondary",
    Icon: "heart",
    defaultGoal: 70,
    goalLabel: "Resting target",
    goalUnit: "bpm",
    format: (n) => `${Math.round(n)} bpm`,
    isLatest: true,
    detail: {
      iconBoxBg: "card",
      iconColor: "destructive",
      plusBg: "card",
      plusColor: "foreground",
      barMuted: "rgba(255,255,255,0.58)",
      barToday: "primary",
      progressTrack: "rgba(255,255,255,0.72)",
      progressFill: "primary",
      entriesHeaderBg: "#4258d628",
      entriesHeaderColor: "primary",
    },
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
    const d = new Date(iso);
    let h = d.getHours();
    const m = d.getMinutes();
    const am = h < 12;
    h = h % 12 || 12;
    return `${h}:${m.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
  } catch {
    return "";
  }
}

function dayLetter(date: string): string {
  const d = new Date(date + "T00:00:00");
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()] ?? "";
}

export default function HealthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  usePrefetchOnFocus("health");
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useGetHealthSummary();
  const createEntry = useCreateHealthEntry();
  const updateEntry = useUpdateHealthEntry();
  const deleteEntry = useDeleteHealthEntry();
  const updateGoals = useUpdateHealthGoals();

  const [logFor, setLogFor] = useState<HealthMetric | null>(null);
  const [editing, setEditing] = useState<{ entry: HealthEntry; metric: HealthMetric } | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [syncingPhone, setSyncingPhone] = useState(false);

  const isAndroid = Platform.OS === "android";

  const summaryByMetric = useMemo(() => {
    const m = new Map<HealthMetric, HealthMetricSummary>();
    data?.metrics.forEach((s) => m.set(s.metric, s));
    return m;
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetHealthSummaryQueryKey() });

  const submitLog = (metric: HealthMetric, value: number) => {
    createEntry.mutate(
      { data: { metric, value } },
      {
        onSuccess: () => {
          setLogFor(null);
          invalidate();
        },
        onError: () => Alert.alert("Couldn't log entry"),
      },
    );
  };

  const submitEdit = (id: number, value: number) => {
    updateEntry.mutate(
      { id, data: { value } },
      {
        onSuccess: () => {
          setEditing(null);
          invalidate();
        },
        onError: () => Alert.alert("Couldn't update entry"),
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteEntry.mutate(
      { id },
      {
        onSuccess: () => invalidate(),
        onError: () => Alert.alert("Couldn't delete entry"),
      },
    );
  };

  const saveGoals = (next: Record<HealthMetric, number>) => {
    updateGoals.mutate(
      { data: { goals: METRIC_ORDER.map((m) => ({ metric: m, goal: next[m] })) } },
      {
        onSuccess: () => {
          setGoalsOpen(false);
          invalidate();
        },
        onError: () => Alert.alert("Couldn't save goals"),
      },
    );
  };

  const onSyncFromPhone = async () => {
    if (!isAndroid) return;
    setSyncingPhone(true);
    try {
      const result = await syncHealthFromPhone({
        getTodayEntryIds: (metric) => summaryByMetric.get(metric)?.entries.map((e) => e.id) ?? [],
      });
      if (result.ok) {
        invalidate();
        Alert.alert("Synced from Health Connect", result.message);
      } else {
        Alert.alert("Couldn't sync", result.message ?? "Try again after allowing access in Settings.");
      }
    } finally {
      setSyncingPhone(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: (isWeb ? 67 : insets.top) + 16,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <Text style={[styles.label, { color: colors.foreground, opacity: 0.65 }]}>WELLNESS</Text>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]} testID="text-health-title">
            Health
          </Text>
          <Pressable
            testID="open-goals"
            onPress={() => setGoalsOpen(true)}
            style={({ pressed }) => [
              styles.goalsBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.foreground,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="settings" size={16} color={colors.foreground} />
            <Text style={[styles.goalsBtnText, { color: colors.foreground }]}>Goals</Text>
          </Pressable>
        </View>

        {isAndroid && !isError && !(isLoading || !data) && (
          <Pressable
            testID="health-sync-phone"
            onPress={onSyncFromPhone}
            disabled={syncingPhone}
            style={({ pressed }) => [
              styles.syncRow,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.foreground,
                opacity: pressed || syncingPhone ? 0.75 : 1,
              },
            ]}
          >
            <Feather name="refresh-cw" size={18} color={colors.foreground} />
            <Text style={[styles.syncRowText, { color: colors.foreground }]}>
              {syncingPhone ? "Syncing…" : "Sync from Health Connect"}
            </Text>
          </Pressable>
        )}

        {isError ? (
          <BrutalCard style={{ padding: 24, alignItems: "center", marginTop: 16 }}>
            <Text style={{ fontWeight: "900", fontSize: 16, color: colors.foreground, marginBottom: 6 }}>
              Couldn't load your health data
            </Text>
            <Text style={{ color: colors.mutedForeground, marginBottom: 14, textAlign: "center" }}>
              Check your connection and try again.
            </Text>
            <Pressable
              onPress={() => refetch()}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.foreground,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "900" }}>Retry</Text>
            </Pressable>
          </BrutalCard>
        ) : isLoading || !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 16 }}>
            {METRIC_ORDER.map((metric) => {
              const s = summaryByMetric.get(metric);
              if (!s) return null;
              return (
                <MetricCard
                  key={metric}
                  metric={metric}
                  summary={s}
                  colors={colors}
                  onLog={() => setLogFor(metric)}
                  onEdit={(e) => setEditing({ entry: e, metric })}
                  onDelete={handleDelete}
                />
              );
            })}
          </View>
        )}
      </ScrollView>

      {logFor && (
        <EntryModal
          metric={logFor}
          title={`Log ${META[logFor].label}`}
          submitLabel="Log"
          isPending={createEntry.isPending}
          onClose={() => setLogFor(null)}
          onSubmit={(v) => submitLog(logFor, v)}
        />
      )}

      {editing && (
        <EntryModal
          metric={editing.metric}
          title={`Edit ${META[editing.metric].label}`}
          submitLabel="Save"
          initialValue={editing.entry.value}
          isPending={updateEntry.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => submitEdit(editing.entry.id, v)}
        />
      )}

      {goalsOpen && (
        <GoalsModal
          initial={
            Object.fromEntries(
              METRIC_ORDER.map((m) => [m, summaryByMetric.get(m)?.goal ?? META[m].defaultGoal]),
            ) as Record<HealthMetric, number>
          }
          isPending={updateGoals.isPending}
          onClose={() => setGoalsOpen(false)}
          onSave={saveGoals}
        />
      )}
    </View>
  );
}

interface MetricCardProps {
  metric: HealthMetric;
  summary: HealthMetricSummary;
  colors: ColorTokens;
  onLog: () => void;
  onEdit: (entry: HealthEntry) => void;
  onDelete: (id: number) => void;
}

const MetricCard = memo(function MetricCard({ metric, summary, colors, onLog, onEdit, onDelete }: MetricCardProps) {
  const meta = META[metric];
  const bg = colors[meta.bg];
  const d = meta.detail;
  const goalPct = meta.isLatest
    ? summary.today > 0
      ? 100
      : 0
    : summary.goal > 0
    ? Math.min(100, Math.round((summary.today / summary.goal) * 100))
    : 0;
  const maxBar = Math.max(1, summary.goal, ...summary.history.map((p) => p.value));

  return (
    <BrutalCard background={bg} shadowOffset={6}>
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeadLeft}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors[d.iconBoxBg], borderColor: colors.foreground },
              ]}
            >
              <Feather name={meta.Icon} size={20} color={colors[d.iconColor]} />
            </View>
            <View>
              <Text style={[styles.cardKicker, { color: colors.foreground, opacity: 0.7 }]}>
                {meta.short.toUpperCase()}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>{meta.label}</Text>
            </View>
          </View>
          <Pressable
            testID={`log-${metric}`}
            onPress={onLog}
            style={({ pressed }) => [
              styles.plusBtn,
              {
                backgroundColor: colors[d.plusBg],
                borderColor: colors.foreground,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus" size={20} color={colors[d.plusColor]} />
          </Pressable>
        </View>

        <View style={styles.valueRow}>
          <Text testID={`value-${metric}`} style={[styles.valueNumber, { color: colors.foreground }]}>
            {meta.format(summary.today)}
          </Text>
          {!meta.isLatest && (
            <Text style={[styles.valueGoal, { color: colors.foreground, opacity: 0.7 }]}>
              {" "}/ {meta.format(summary.goal)}
            </Text>
          )}
        </View>

        {meta.isLatest && summary.todayCount > 0 && summary.todayMin != null && summary.todayMax != null && summary.todayAvg != null ? (
          <Text style={[styles.subtext, { color: colors.foreground }]}>
            min {Math.round(summary.todayMin)} · avg {Math.round(summary.todayAvg)} · max {Math.round(summary.todayMax)} bpm
          </Text>
        ) : meta.isLatest ? (
          <Text style={[styles.subtext, { color: colors.foreground }]}>No reading yet today</Text>
        ) : (
          <View style={[styles.barTrack, { backgroundColor: d.progressTrack, borderColor: colors.foreground }]}>
            <View style={[styles.barFill, { width: `${goalPct}%`, backgroundColor: colors[d.progressFill] }]} />
          </View>
        )}

        {/* 7-day mini history */}
        <View style={styles.historyRow}>
          {summary.history.map((p, idx) => {
            const pct = maxBar > 0 ? Math.max(p.value > 0 ? 8 : 4, Math.round((p.value / maxBar) * 100)) : 4;
            const isToday = idx === summary.history.length - 1;
            return (
              <View key={p.date} style={styles.historyCol}>
                <View style={styles.barCell}>
                  <View
                    testID={`bar-${metric}-${p.date}`}
                    style={{
                      width: "100%",
                      height: `${pct}%`,
                      backgroundColor: isToday ? colors[d.barToday] : d.barMuted,
                      borderWidth: 2,
                      borderColor: colors.foreground,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                    }}
                  />
                </View>
                <Text style={[styles.dayLabel, { color: colors.foreground, opacity: 0.7 }]}>
                  {dayLetter(p.date)}
                </Text>
              </View>
            );
          })}
        </View>

        {summary.entries.length > 0 && (
          <View
            style={[styles.entriesBox, { backgroundColor: colors.card, borderColor: colors.foreground, paddingBottom: 8 }]}
          >
            <View
              style={[
                styles.entriesTitleWrap,
                { backgroundColor: d.entriesHeaderBg, borderBottomColor: `${colors.foreground}33` },
              ]}
            >
              <Text style={[styles.entriesTitle, { color: colors[d.entriesHeaderColor] }]}>
                TODAY · {summary.entries.length}
              </Text>
            </View>
            {summary.entries.map((e) => (
              <View
                key={e.id}
                testID={`entry-${metric}-${e.id}`}
                style={[styles.entryRow, { borderTopColor: colors.foreground }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.entryValue, { color: colors.foreground }]}>{meta.format(e.value)}</Text>
                  <Text style={[styles.entryTime, { color: colors.foreground, opacity: 0.7 }]}>
                    {formatTime(e.recordedAt)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pressable
                    testID={`edit-${metric}-${e.id}`}
                    onPress={() => onEdit(e)}
                    style={({ pressed }) => [
                      styles.iconBtnSm,
                      { borderColor: colors.foreground, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="edit-2" size={14} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    testID={`delete-${metric}-${e.id}`}
                    onPress={() => onDelete(e.id)}
                    style={({ pressed }) => [
                      styles.iconBtnSm,
                      { borderColor: colors.foreground, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color={colors.foreground} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </BrutalCard>
  );
});

interface EntryModalProps {
  metric: HealthMetric;
  title: string;
  submitLabel: string;
  initialValue?: number;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (value: number) => void;
}

function EntryModal({ metric, title, submitLabel, initialValue, isPending, onClose, onSubmit }: EntryModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const meta = META[metric];
  const [value, setValue] = useState<string>(initialValue !== undefined ? String(initialValue) : "");

  const submit = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      Alert.alert("Enter a non-negative number");
      return;
    }
    onSubmit(n);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: insets.top + 40 }]}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.foreground },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.foreground }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
            <Pressable
              testID="close-entry-modal"
              onPress={onClose}
              style={({ pressed }) => [
                styles.iconBtnSm,
                { borderColor: colors.foreground, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={16} color={colors.foreground} />
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>VALUE ({meta.unit})</Text>
            <TextInput
              testID="entry-value-input"
              autoFocus
              keyboardType="decimal-pad"
              value={value}
              onChangeText={setValue}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.input,
                { borderColor: colors.foreground, backgroundColor: colors.background, color: colors.foreground },
              ]}
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <BrutalButton
                label="Cancel"
                background={colors.muted}
                textColor={colors.foreground}
                containerStyle={{ flex: 1 }}
                onPress={onClose}
              />
              <BrutalButton
                label={isPending ? "..." : submitLabel}
                containerStyle={{ flex: 1 }}
                disabled={isPending || value === ""}
                onPress={submit}
                testID="submit-entry"
              />
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

interface GoalsModalProps {
  initial: Record<HealthMetric, number>;
  isPending: boolean;
  onClose: () => void;
  onSave: (next: Record<HealthMetric, number>) => void;
}

function GoalsModal({ initial, isPending, onClose, onSave }: GoalsModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Record<HealthMetric, string>>(() =>
    Object.fromEntries(METRIC_ORDER.map((m) => [m, String(initial[m])])) as Record<HealthMetric, string>,
  );

  const submit = () => {
    const next: Record<HealthMetric, number> = { ...initial };
    for (const m of METRIC_ORDER) {
      const n = Number(values[m]);
      if (!Number.isFinite(n) || n <= 0) {
        Alert.alert("Goals must be positive numbers");
        return;
      }
      next[m] = n;
    }
    onSave(next);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: insets.top + 30 }]}>
        <View
          style={[
            styles.modalCard,
            { backgroundColor: colors.card, borderColor: colors.foreground, maxHeight: "85%" },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.foreground }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="target" size={18} color={colors.foreground} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Set Goals</Text>
            </View>
            <Pressable
              testID="close-goals-modal"
              onPress={onClose}
              style={({ pressed }) => [
                styles.iconBtnSm,
                { borderColor: colors.foreground, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={16} color={colors.foreground} />
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 16, gap: 14 }}>
            {METRIC_ORDER.map((m) => {
              const meta = META[m];
              const bg = colors[meta.bg];
              return (
                <View key={m} style={styles.goalRow}>
                  <View style={[styles.iconBox, { backgroundColor: bg, borderColor: colors.foreground }]}>
                    <Feather name={meta.Icon} size={18} color={colors.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                      {meta.goalLabel.toUpperCase()}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <TextInput
                        testID={`goal-input-${m}`}
                        keyboardType="decimal-pad"
                        value={values[m]}
                        onChangeText={(v) => setValues((prev) => ({ ...prev, [m]: v }))}
                        style={[
                          styles.input,
                          {
                            flex: 1,
                            borderColor: colors.foreground,
                            backgroundColor: colors.background,
                            color: colors.foreground,
                          },
                        ]}
                      />
                      <Text style={[styles.fieldLabel, { color: colors.foreground, opacity: 0.7, width: 50 }]}>
                        {meta.goalUnit.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <BrutalButton
                label="Cancel"
                background={colors.muted}
                textColor={colors.foreground}
                containerStyle={{ flex: 1 }}
                onPress={onClose}
              />
              <BrutalButton
                label={isPending ? "..." : "Save Goals"}
                containerStyle={{ flex: 1 }}
                disabled={isPending}
                onPress={submit}
                testID="save-goals"
              />
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 18 },
  label: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1.5 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  title: { fontFamily: "Inter_900Black", fontSize: 38, letterSpacing: -1 },
  goalsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 3,
    borderRadius: 12,
  },
  goalsBtnText: { fontFamily: "Inter_800ExtraBold", fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase" },
  syncRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 3,
    borderRadius: 14,
  },
  syncRowText: { fontFamily: "Inter_900Black", fontSize: 14, letterSpacing: 0.2 },
  loadingContainer: { paddingVertical: 80, alignItems: "center" },
  cardBody: { padding: 16, gap: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardHeadLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 42,
    height: 42,
    borderWidth: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardKicker: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2 },
  cardTitle: { fontFamily: "Inter_900Black", fontSize: 18, letterSpacing: -0.3 },
  plusBtn: {
    width: 38,
    height: 38,
    borderWidth: 3,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  valueRow: { flexDirection: "row", alignItems: "baseline" },
  valueNumber: { fontFamily: "Inter_900Black", fontSize: 34, letterSpacing: -1 },
  valueGoal: { fontFamily: "Inter_700Bold", fontSize: 14 },
  subtext: { fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.85 },
  barTrack: { height: 12, borderWidth: 3, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%" },
  historyRow: { flexDirection: "row", height: 70, alignItems: "flex-end", gap: 6 },
  historyCol: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barCell: { flex: 1, width: "100%", justifyContent: "flex-end" },
  dayLabel: { fontFamily: "Inter_900Black", fontSize: 10 },
  entriesBox: { borderWidth: 3, borderRadius: 14, overflow: "hidden", paddingHorizontal: 0, paddingVertical: 0 },
  entriesTitleWrap: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 3,
  },
  entriesTitle: { fontFamily: "Inter_900Black", fontSize: 11, letterSpacing: 1.2 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderTopWidth: 2,
  },
  entryValue: { fontFamily: "Inter_900Black", fontSize: 16 },
  entryTime: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" },
  iconBtnSm: {
    width: 30,
    height: 30,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(20,20,20,0.6)",
    paddingHorizontal: 16,
  },
  modalCard: {
    borderWidth: 3,
    borderRadius: 22,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 3,
  },
  modalTitle: { fontFamily: "Inter_900Black", fontSize: 18, letterSpacing: -0.3 },
  fieldLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2 },
  input: {
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: "Inter_900Black",
    fontSize: 22,
  },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
