import { Feather } from "@expo/vector-icons";
import {
  getGetDashboardQueryKey,
  getGetWalletQueryKey,
  getListHabitsQueryKey,
  useCompleteHabit,
  useListHabits,
  useUncompleteHabit,
  useUpdateCompletion,
  type HabitMood,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalCard } from "@/components/BrutalCard";
import { GroceryList } from "@/components/GroceryList";
import { MoodSheet, MOOD_EMOJI } from "@/components/MoodSheet";
import { WalletChips } from "@/components/WalletChips";
import { useClerk, useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";
import {
  formatPrettyDate,
  isHabitActiveToday,
  getReadableForeground,
  resolveHabitColor,
  todayString,
} from "@/lib/colors";
import type { Habit } from "@workspace/api-client-react";

type ColorTokens = ReturnType<typeof useColors>;
type HabitsCtx = { previous: Habit[] | undefined; previousDashboard?: unknown };

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();
  usePrefetchOnFocus("today");
  const { data: allHabits, isLoading } = useListHabits();
  const habitsKey = useMemo(() => getListHabitsQueryKey(), []);
  const dashboardKey = useMemo(() => getGetDashboardQueryKey(), []);

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

  const [rewardToast, setRewardToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  useEffect(() => {
    if (!rewardToast) return;
    const t = setTimeout(() => setRewardToast(null), 3000);
    return () => clearTimeout(t);
  }, [rewardToast]);
  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(t);
  }, [errorToast]);

  const completeMutation = useCompleteHabit<Error, HabitsCtx>({
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
      onError: (_e, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        if (ctx?.previousDashboard !== undefined) queryClient.setQueryData(dashboardKey, ctx.previousDashboard);
        setErrorToast("Couldn't mark complete");
      },
      onSuccess: (res, vars) => {
        patchHabit(vars.id, {
          completedToday: true,
          todayMood: res.completion.mood ?? null,
          todayNote: res.completion.note ?? null,
        });
        if (res.coinsAwarded > 0) {
          const parts = [`+${res.coinsAwarded} coins`];
          if (res.foodAwarded > 0) parts.push(`+${res.foodAwarded} food`);
          if (res.waterAwarded > 0) parts.push(`+${res.waterAwarded} water`);
          setRewardToast(parts.join(" · "));
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
      },
    },
  });

  const uncompleteMutation = useUncompleteHabit<Error, HabitsCtx>({
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
      onError: (_e, _vars, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        if (ctx?.previousDashboard !== undefined) queryClient.setQueryData(dashboardKey, ctx.previousDashboard);
        setErrorToast("Couldn't remove completion");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
    },
  });

  const updateCompletion = useUpdateCompletion<Error, HabitsCtx>({
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
      onError: (_e, _v, ctx) => {
        if (ctx?.previous) queryClient.setQueryData(habitsKey, ctx.previous);
        setErrorToast("Couldn't save mood/note");
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: habitsKey });
      },
    },
  });

  const dateLabel = useMemo(() => formatPrettyDate(), []);
  const habits = useMemo(
    () => (allHabits ?? []).filter((h) => isHabitActiveToday(h.targetDays)),
    [allHabits],
  );
  const total = habits.length;
  const completed = useMemo(
    () => habits.filter((h) => h.completedToday).length,
    [habits],
  );
  const allDone = total > 0 && completed === total;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const [sheetHabitId, setSheetHabitId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sheetHabit = useMemo(
    () => (sheetHabitId == null ? null : habits.find((h) => h.id === sheetHabitId) ?? null),
    [sheetHabitId, habits],
  );
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  // Tracks in-flight POST /complete promises so Save/Remove can await them
  // and avoid PATCH/DELETE racing ahead of the initial creation.
  const inFlightCompleteRef = useRef<Map<number, Promise<unknown>>>(new Map());

  const openSheet = useCallback(
    (habit: Habit) => {
      if (Platform.OS !== "web") {
        const style = habit.completedToday
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium;
        requestAnimationFrame(() => {
          Haptics.impactAsync(style).catch(() => {});
        });
      }
      if (!habit.completedToday) {
        const p = completeMutation.mutateAsync({ id: habit.id, data: { date: todayString() } });
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
    },
    [completeMutation],
  );

  const handleSave = useCallback(
    (mood: HabitMood | null, note: string | null) => {
      if (sheetHabitId == null) return;
      const id = sheetHabitId;
      setSheetOpen(false);
      const inFlight = inFlightCompleteRef.current.get(id);
      const fire = (val?: unknown) => {
        if (val === "__failed__") return;
        updateCompletion.mutate({ id, data: { date: todayString(), mood, note } });
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
      if (val === "__failed__") return;
      uncompleteMutation.mutate({ id, data: { date: todayString() } });
    };
    if (inFlight) inFlight.then(fire, () => {});
    else fire();
  }, [sheetHabitId, uncompleteMutation]);

  const renderItem = useCallback(
    ({ item, index }: { item: Habit; index: number }) => (
      <TodayHabitItem habit={item} index={index} colors={colors} onPress={openSheet} />
    ),
    [colors, openSheet],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.appBar,
          {
            backgroundColor: colors.background,
            borderBottomColor: colors.foreground,
            paddingTop: (isWeb ? 12 : insets.top) + 8,
          },
        ]}
      >
        <WelcomeBar colors={colors} />
      </View>
      <FlatList
        data={habits}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: 12,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        ItemSeparatorComponent={Separator}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        alwaysBounceVertical={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View>
            <Text
              style={[
                styles.dateLabel,
                { color: colors.foreground, opacity: 0.65 },
              ]}
              testID="text-today-date"
            >
              {dateLabel}
            </Text>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: colors.foreground }]}
                testID="text-today-title"
              >
                Today
              </Text>
              <WalletChips />
            </View>
            {rewardToast && (
              <View
                testID="reward-toast"
                style={[
                  styles.rewardToast,
                  { backgroundColor: colors.accent, borderColor: colors.foreground },
                ]}
              >
                <View style={[styles.toastIcon, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
                  <Feather name="gift" size={14} color={colors.foreground} />
                </View>
                <Text style={[styles.rewardToastText, { color: colors.foreground, flex: 1 }]}>
                  {rewardToast}
                </Text>
                <Pressable
                  testID="reward-toast-close"
                  onPress={() => setRewardToast(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={[styles.toastClose, { borderColor: colors.foreground, backgroundColor: colors.background }]}
                >
                  <Feather name="x" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            )}
            {errorToast && (
              <View
                testID="error-toast"
                style={[
                  styles.rewardToast,
                  { backgroundColor: colors.destructive ?? "#ef4444", borderColor: colors.foreground },
                ]}
              >
                <View style={[styles.toastIcon, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
                  <Feather name="alert-circle" size={14} color={colors.foreground} />
                </View>
                <Text style={[styles.rewardToastText, { color: colors.destructiveForeground ?? "#fff", flex: 1 }]}>
                  {errorToast}
                </Text>
                <Pressable
                  testID="error-toast-close"
                  onPress={() => setErrorToast(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  style={[styles.toastClose, { borderColor: colors.foreground, backgroundColor: colors.background }]}
                >
                  <Feather name="x" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            )}
            {total > 0 && (
              <View
                style={[
                  styles.progressCard,
                  {
                    backgroundColor: colors.accent,
                    borderColor: colors.foreground,
                  },
                ]}
              >
                <View style={styles.progressTop}>
                  <Text style={[styles.progressLabel, { color: colors.foreground }]}>
                    {allDone ? "All done!" : "Today's habits"}
                  </Text>
                  <Text
                    style={[styles.progressCount, { color: colors.foreground }]}
                    testID="text-today-progress"
                  >
                    {completed}/{total}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.background, borderColor: colors.foreground }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${progressPct}%`,
                        backgroundColor: allDone ? colors.foreground : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>
        }
        ListFooterComponent={<GroceryList />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.foreground} />
            </View>
          ) : (
            <BrutalCard background={colors.card} containerStyle={{ marginTop: 8 }}>
              <View style={styles.emptyState}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                  testID="text-empty-today"
                >
                  No habits yet
                </Text>
                <Text
                  style={[styles.emptyDesc, { color: colors.mutedForeground }]}
                >
                  Head to the Habits tab to add your first one.
                </Text>
              </View>
            </BrutalCard>
          )
        }
      />

      <MoodSheet
        open={sheetOpen}
        habit={sheetHabit}
        onClose={closeSheet}
        onSave={handleSave}
        onRemove={handleRemove}
      />
    </View>
  );
}

const keyExtractor = (h: Habit) => String(h.id);
const Separator = () => <View style={{ height: 8 }} />;

function WelcomeBar({ colors }: { colors: ColorTokens }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const displayName = user?.firstName
    ?? user?.username
    ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0]
    ?? "";

  if (!displayName) return null;

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You can log back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } },
    ]);
  };

  return (
    <View style={welcomeStyles.row} testID="welcome-bar">
      <View style={welcomeStyles.greeting}>
        <Text style={[welcomeStyles.text, { color: colors.foreground }]} numberOfLines={1}>
          Welcome,{" "}
          <Text style={{ fontFamily: "Inter_900Black" }} testID="welcome-username">
            {displayName}
          </Text>
        </Text>
      </View>
      <Pressable
        onPress={confirmSignOut}
        testID="sign-out"
        accessibilityLabel="Sign out"
        style={[welcomeStyles.signOutBtn, { borderColor: colors.foreground, backgroundColor: colors.card }]}
      >
        <Feather name="log-out" size={16} color={colors.foreground} />
      </Pressable>

    </View>
  );
}

const welcomeStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  greeting: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontFamily: "Inter_700Bold", fontSize: 14, letterSpacing: 0.3 },
  signOutBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 360, borderWidth: 3, borderRadius: 18, padding: 18, gap: 12 },
  modalTitle: { fontFamily: "Inter_900Black", fontSize: 18, letterSpacing: -0.3 },
  input: { borderWidth: 3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_700Bold", fontSize: 16 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 2.5 },
  btnText: { fontFamily: "Inter_900Black", fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase" },
});

interface TodayHabitItemProps {
  habit: Habit;
  index: number;
  colors: ColorTokens;
  onPress: (habit: Habit) => void;
}

const TodayHabitItem = memo(function TodayHabitItem({
  habit,
  index,
  colors,
  onPress,
}: TodayHabitItemProps) {
  const bg = habit.completedToday ? colors.muted : resolveHabitColor(habit.color, index);
  const fg = habit.completedToday ? colors.foreground : getReadableForeground(bg);
  const moodEmoji = habit.todayMood ? MOOD_EMOJI[habit.todayMood] : null;
  return (
    <Pressable
      onPress={() => onPress(habit)}
      testID={`button-toggle-habit-${habit.id}`}
    >
      <BrutalCard background={bg} shadowOffset={6}>
        <View style={styles.habitRow}>
          <View
            style={[
              styles.checkBox,
              {
                backgroundColor: habit.completedToday ? colors.foreground : colors.card,
                borderColor: colors.foreground,
              },
            ]}
          >
            {habit.completedToday ? (
              <Feather name="check" size={18} color={colors.accent} />
            ) : null}
          </View>
          <View style={styles.habitText}>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.habitName,
                  {
                    color: fg,
                    textDecorationLine: habit.completedToday ? "line-through" : "none",
                    opacity: habit.completedToday ? 0.55 : 1,
                  },
                ]}
                testID={`text-habit-name-${habit.id}`}
                numberOfLines={1}
              >
                {habit.name}
              </Text>
              {moodEmoji ? (
                <Text
                  style={styles.moodBadge}
                  testID={`mood-badge-${habit.id}`}
                  accessibilityLabel={`Mood: ${habit.todayMood}`}
                >
                  {moodEmoji}
                </Text>
              ) : null}
            </View>
            {habit.todayNote ? (
              <Text
                style={[
                  styles.habitDesc,
                  {
                    color: fg,
                    opacity: 0.8,
                    fontStyle: "italic",
                  },
                ]}
                numberOfLines={2}
                testID={`note-${habit.id}`}
              >
                “{habit.todayNote}”
              </Text>
            ) : habit.description ? (
              <Text
                style={[
                  styles.habitDesc,
                  {
                    color: fg,
                    opacity: habit.completedToday ? 0.4 : 0.8,
                  },
                ]}
                numberOfLines={2}
              >
                {habit.description}
              </Text>
            ) : null}
          </View>
          {habit.currentStreak > 0 ? (
            <View
              style={[styles.streakPill, { backgroundColor: colors.foreground }]}
              testID={`badge-streak-${habit.id}`}
            >
              <Feather name="zap" size={12} color={colors.accent} />
              <Text
                style={{
                  color: colors.accent,
                  fontFamily: "Inter_900Black",
                  fontSize: 12,
                }}
              >
                {habit.currentStreak}
              </Text>
            </View>
          ) : null}
        </View>
      </BrutalCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  appBar: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 3,
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  dateLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 44,
    letterSpacing: -1.5,
    marginTop: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  rewardToast: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  rewardToastText: { fontFamily: "Inter_900Black", fontSize: 13, letterSpacing: 0.5 },
  toastIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  toastClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCard: {
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressCount: {
    fontFamily: "Inter_900Black",
    fontSize: 14,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontFamily: "Inter_900Black",
    fontSize: 20,
    marginTop: 4,
  },
  emptyDesc: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  checkBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  habitText: {
    flex: 1,
    gap: 2,
  },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  habitName: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 15,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  moodBadge: { fontSize: 15, lineHeight: 18 },
  habitDesc: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
