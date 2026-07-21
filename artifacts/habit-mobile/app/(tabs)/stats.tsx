import { Feather } from "@expo/vector-icons";
import { useGetDashboard, useListHabits, type HabitStats } from "@workspace/api-client-react";
import React, { memo, useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalCard } from "@/components/BrutalCard";
import { CalendarOverview } from "@/components/CalendarOverview";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";
import { resolveHabitColor } from "@/lib/colors";

type ColorTokens = ReturnType<typeof useColors>;

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  usePrefetchOnFocus("stats");
  const { data, isLoading } = useGetDashboard();
  const { data: habits } = useListHabits();
  const { data: archivedHabits } = useListHabits({ archived: true });
  const hasAnyHabit =
    (habits ?? []).length > 0 || (archivedHabits ?? []).length > 0;

  const completionPct = useMemo(
    () => (data ? Math.round(data.todayCompletionRate * 100) : 0),
    [data],
  );
  const weeklyPct = useMemo(
    () => (data ? Math.round(data.weeklyCompletionRate * 100) : 0),
    [data],
  );

  const rows = useMemo(() => {
    if (!data) return [] as { stat: HabitStats; color: string; pct: number }[];
    const byId = new Map((habits ?? []).map((h, i) => [h.id, { habit: h, index: i }]));
    return data.habitStats.map((s, i) => {
      const found = byId.get(s.habitId);
      const color = resolveHabitColor(found?.habit.color ?? null, found?.index ?? i);
      const pct = Math.min(100, Math.round((s.weeklyCompletions / 7) * 100));
      return { stat: s, color, pct };
    });
  }, [data, habits]);

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
        <Text
          style={[styles.label, { color: colors.foreground, opacity: 0.65 }]}
        >
          PROGRESS
        </Text>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          testID="text-stats-title"
        >
          Stats
        </Text>

        {isLoading || !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : (
          <>
            <View style={styles.statRow}>
              <BrutalCard
                background={colors.primary}
                containerStyle={{ flex: 1 }}
                shadowOffset={6}
              >
                <View style={styles.statBox}>
                  <Text
                    style={[
                      styles.statLabel,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    TODAY
                  </Text>
                  <Text
                    style={[
                      styles.statNumber,
                      { color: colors.primaryForeground },
                    ]}
                    testID="text-stat-today"
                  >
                    {completionPct}%
                  </Text>
                  <Text
                    style={[
                      styles.statSub,
                      { color: colors.primaryForeground, opacity: 0.85 },
                    ]}
                  >
                    {data.completedToday}/{data.totalHabits} done
                  </Text>
                </View>
              </BrutalCard>
              <BrutalCard
                background={colors.accent}
                containerStyle={{ flex: 1 }}
                shadowOffset={6}
              >
                <View style={styles.statBox}>
                  <Text
                    style={[styles.statLabel, { color: colors.foreground }]}
                  >
                    THIS WEEK
                  </Text>
                  <Text
                    style={[styles.statNumber, { color: colors.foreground }]}
                    testID="text-stat-week"
                  >
                    {weeklyPct}%
                  </Text>
                  <Text
                    style={[
                      styles.statSub,
                      { color: colors.foreground, opacity: 0.7 },
                    ]}
                  >
                    7-day rate
                  </Text>
                </View>
              </BrutalCard>
            </View>

            <BrutalCard
              background={colors.secondary}
              containerStyle={{ marginTop: 14 }}
              shadowOffset={6}
            >
              <View style={styles.streakBox}>
                <View style={styles.streakHeader}>
                  <View
                    style={[
                      styles.streakIconBox,
                      {
                        backgroundColor: colors.foreground,
                        borderColor: colors.foreground,
                      },
                    ]}
                  >
                    <Feather name="zap" size={24} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.statLabel, { color: colors.foreground }]}
                    >
                      LONGEST ACTIVE STREAK
                    </Text>
                    <Text
                      style={[
                        styles.streakNumber,
                        { color: colors.foreground },
                      ]}
                      testID="text-stat-longest-streak"
                    >
                      {data.longestActiveStreak}
                      <Text style={styles.streakDays}> days</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </BrutalCard>

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, marginTop: 26 },
              ]}
            >
              By habit
            </Text>

            {rows.length === 0 ? (
              <BrutalCard background={colors.card}>
                <View style={styles.emptyState}>
                  <Feather
                    name="bar-chart-2"
                    size={36}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[styles.emptyTitle, { color: colors.foreground }]}
                    testID="text-empty-stats"
                  >
                    No data yet
                  </Text>
                </View>
              </BrutalCard>
            ) : (
              <View style={{ gap: 12 }}>
                {rows.map((row) => (
                  <HabitStatRow key={row.stat.habitId} row={row} colors={colors} />
                ))}
              </View>
            )}

            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, marginTop: 26 },
              ]}
            >
              Calendar
            </Text>
            {hasAnyHabit ? (
              <CalendarOverview habits={habits ?? []} />
            ) : (
              <BrutalCard background={colors.card}>
                <View style={styles.emptyState}>
                  <Feather name="calendar" size={36} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                    No habits yet
                  </Text>
                </View>
              </BrutalCard>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface HabitStatRowProps {
  row: { stat: HabitStats; color: string; pct: number };
  colors: ColorTokens;
}

const HabitStatRow = memo(function HabitStatRow({ row, colors }: HabitStatRowProps) {
  const { stat: s, color, pct } = row;
  return (
    <BrutalCard background={colors.card} shadowOffset={5}>
      <View style={styles.habitStatRow}>
        <View style={styles.habitStatHeader}>
          <Text
            style={[styles.habitStatName, { color: colors.foreground }]}
            testID={`text-habit-stat-${s.habitId}`}
            numberOfLines={1}
          >
            {s.name}
          </Text>
          <View style={[styles.miniBadge, { backgroundColor: colors.foreground }]}>
            <Feather name="zap" size={11} color={colors.accent} />
            <Text style={[styles.miniBadgeText, { color: colors.accent }]}>
              {s.currentStreak}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.barTrack,
            { backgroundColor: colors.muted, borderColor: colors.foreground },
          ]}
        >
          <View
            style={[
              styles.barFill,
              { width: `${pct}%`, backgroundColor: color },
            ]}
          />
        </View>
        <View style={styles.habitStatFooter}>
          <Text style={[styles.statSub, { color: colors.mutedForeground }]}>
            {s.weeklyCompletions}/7 this week
          </Text>
          <Text style={[styles.statSub, { color: colors.foreground }]}>
            BEST {s.longestStreak}
          </Text>
        </View>
      </View>
    </BrutalCard>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 18 },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 44,
    letterSpacing: -1.5,
    marginTop: 2,
    marginBottom: 18,
  },
  loadingContainer: { paddingVertical: 80, alignItems: "center" },
  statRow: { flexDirection: "row", gap: 12 },
  statBox: { padding: 18, gap: 4 },
  statLabel: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  statNumber: {
    fontFamily: "Inter_900Black",
    fontSize: 44,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  statSub: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  streakBox: { padding: 18 },
  streakHeader: { flexDirection: "row", gap: 14, alignItems: "center" },
  streakIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: {
    fontFamily: "Inter_900Black",
    fontSize: 36,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  streakDays: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_900Black",
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  emptyState: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontFamily: "Inter_900Black", fontSize: 18 },
  habitStatRow: { padding: 14, gap: 8 },
  habitStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  habitStatName: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 16,
    flex: 1,
  },
  barTrack: {
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
  },
  habitStatFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniBadgeText: { fontFamily: "Inter_900Black", fontSize: 11 },
});
