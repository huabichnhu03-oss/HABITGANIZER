import { Feather } from "@expo/vector-icons";
import { useGetHistory } from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalCard } from "@/components/BrutalCard";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";
import { resolveHabitColor } from "@/lib/colors";

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

function ymKey(year: number, month: number): number {
  return year * 12 + (month - 1);
}
function fromYmKey(k: number): { year: number; month: number } {
  return { year: Math.floor(k / 12), month: (k % 12) + 1 };
}
function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  usePrefetchOnFocus("history");

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, isLoading } = useGetHistory({ year, month });

  const currentKey = ymKey(now.getFullYear(), now.getMonth() + 1);
  const viewKey = ymKey(year, month);

  const earliestKey = useMemo(() => {
    if (!data?.earliestCompletionDate) return viewKey;
    const d = new Date(`${data.earliestCompletionDate}T00:00:00`);
    return ymKey(d.getFullYear(), d.getMonth() + 1);
  }, [data?.earliestCompletionDate, viewKey]);

  const canGoBack = viewKey > earliestKey;
  const canGoForward = viewKey < currentKey;

  const goPrev = () => {
    if (!canGoBack) return;
    const next = fromYmKey(viewKey - 1);
    setYear(next.year);
    setMonth(next.month);
  };
  const goNext = () => {
    if (!canGoForward) return;
    const next = fromYmKey(viewKey + 1);
    setYear(next.year);
    setMonth(next.month);
  };

  const totalCompletions = (data?.habits ?? []).reduce(
    (sum, h) => sum + h.completions.length,
    0,
  );
  const habitsWithData = (data?.habits ?? []).filter(
    (h) => h.completions.length > 0,
  );

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
      >
        <Text
          style={[styles.label, { color: colors.foreground, opacity: 0.65 }]}
        >
          LOOK BACK
        </Text>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          testID="text-history-title"
        >
          History
        </Text>

        <BrutalCard background={colors.card} containerStyle={{ marginTop: 4 }}>
          <View style={styles.monthBar}>
            <Pressable
              onPress={goPrev}
              disabled={!canGoBack}
              testID="history-prev-month"
              accessibilityLabel="Previous month"
              style={({ pressed }) => [
                styles.navBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.foreground,
                  opacity: !canGoBack ? 0.3 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="chevron-left"
                size={26}
                color={colors.foreground}
              />
            </Pressable>
            <View style={styles.monthLabel}>
              <Feather
                name="calendar"
                size={14}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.monthText, { color: colors.foreground }]}
                testID="text-history-month"
                numberOfLines={1}
              >
                {MONTH_NAMES[month - 1]} {year}
              </Text>
            </View>
            <Pressable
              onPress={goNext}
              disabled={!canGoForward}
              testID="history-next-month"
              accessibilityLabel="Next month"
              style={({ pressed }) => [
                styles.navBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.foreground,
                  opacity: !canGoForward ? 0.3 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="chevron-right"
                size={26}
                color={colors.foreground}
              />
            </Pressable>
          </View>
        </BrutalCard>

        {isLoading || !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.foreground} />
          </View>
        ) : totalCompletions === 0 ? (
          <BrutalCard
            background={colors.muted}
            containerStyle={{ marginTop: 18 }}
          >
            <View style={styles.emptyState}>
              <Feather
                name="calendar"
                size={42}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.emptyTitle, { color: colors.foreground }]}
                testID="text-history-empty"
              >
                Nothing logged this month
              </Text>
              <Text
                style={[
                  styles.emptySub,
                  { color: colors.mutedForeground },
                ]}
              >
                Pick a different month or come back after you check things off.
              </Text>
            </View>
          </BrutalCard>
        ) : (
          <View style={{ gap: 14, marginTop: 18 }}>
            {habitsWithData.map((habit, i) => {
              const color = resolveHabitColor(habit.color, i);
              return (
                <BrutalCard
                  key={habit.id}
                  background={colors.card}
                  shadowOffset={5}
                >
                  <View
                    style={styles.habitBlock}
                    testID={`history-habit-${habit.id}`}
                  >
                    <View style={styles.habitHeader}>
                      <View
                        style={[
                          styles.iconChip,
                          {
                            backgroundColor: color,
                            borderColor: colors.foreground,
                          },
                        ]}
                      >
                        <Feather
                          name="check"
                          size={20}
                          color={colors.foreground}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            styles.habitName,
                            { color: colors.foreground },
                          ]}
                          numberOfLines={1}
                        >
                          {habit.name}
                        </Text>
                        <Text
                          style={[
                            styles.habitCount,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {habit.completions.length}{" "}
                          {habit.completions.length === 1 ? "day" : "days"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: 8 }}>
                      {habit.completions.map((c) => (
                        <View
                          key={c.completedDate}
                          style={[
                            styles.completionRow,
                            {
                              backgroundColor: colors.muted,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text style={styles.moodEmoji}>
                            {c.mood ? MOOD_EMOJI[c.mood] ?? "✓" : "✓"}
                          </Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                styles.dateLabel,
                                { color: colors.foreground },
                              ]}
                            >
                              {dayLabel(c.completedDate)}
                            </Text>
                            {c.note ? (
                              <Text
                                style={[
                                  styles.noteText,
                                  { color: colors.foreground },
                                ]}
                              >
                                {c.note}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </BrutalCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    gap: 10,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  monthText: {
    fontFamily: "Inter_900Black",
    fontSize: 22,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontFamily: "Inter_900Black", fontSize: 20 },
  emptySub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textAlign: "center",
  },
  habitBlock: { padding: 14, gap: 12 },
  habitHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  habitName: { fontFamily: "Inter_900Black", fontSize: 18 },
  habitCount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  completionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  moodEmoji: { fontSize: 22, lineHeight: 26, width: 28, textAlign: "center" },
  dateLabel: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  noteText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
