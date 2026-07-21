import { Feather } from "@expo/vector-icons";
import { useGetLeaderboard, type LeaderboardEntry } from "@workspace/api-client-react";
import React, { useState } from "react";
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

type Scope = "friends" | "global";
type Metric = "coins" | "completions";

const SCOPE_OPTIONS: { value: Scope; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "friends", label: "Friends", icon: "users" },
  { value: "global", label: "Global", icon: "globe" },
];

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "coins", label: "Coins" },
  { value: "completions", label: "Done" },
];

function RankIcon({ rank, colors }: { rank: number; colors: ReturnType<typeof useColors> }) {
  if (rank === 1) return <Feather name="award" size={22} color="#eab308" />;
  if (rank === 2) return <Feather name="award" size={22} color="#9ca3af" />;
  if (rank === 3) return <Feather name="award" size={22} color="#b45309" />;
  return (
    <Text style={[styles.rankText, { color: colors.mutedForeground }]}>{rank}</Text>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  usePrefetchOnFocus("leaderboard");

  const [scope, setScope] = useState<Scope>("friends");
  const [metric, setMetric] = useState<Metric>("coins");

  const leaderboardQuery = useGetLeaderboard(
    { scope, metric, limit: 50 },
    {
      query: {
        queryKey: ["leaderboard", scope, metric],
        refetchOnWindowFocus: false,
      },
    }
  );

  const entries = leaderboardQuery.data?.entries ?? [];
  const isLoading = leaderboardQuery.isLoading;

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
        <View style={styles.header}>
          <Feather name="award" size={28} color={colors.foreground} />
          <Text style={[styles.title, { color: colors.foreground }]}>Leaderboard</Text>
        </View>

        {/* Scope Toggle */}
        <View style={styles.toggleRow}>
          {SCOPE_OPTIONS.map((opt) => {
            const isActive = scope === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: isActive ? colors.foreground : colors.card,
                    borderColor: colors.foreground,
                  },
                ]}
                onPress={() => setScope(opt.value)}
              >
                <Feather
                  name={opt.icon}
                  size={16}
                  color={isActive ? colors.background : colors.foreground}
                />
                <Text
                  style={[
                    styles.toggleText,
                    { color: isActive ? colors.background : colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Metric Toggle */}
        <View style={[styles.toggleRow, { marginBottom: 16 }]}>
          {METRIC_OPTIONS.map((opt) => {
            const isActive = metric === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: isActive ? colors.foreground : colors.card,
                    borderColor: colors.foreground,
                  },
                ]}
                onPress={() => setMetric(opt.value)}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: isActive ? colors.background : colors.foreground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Leaderboard Entries */}
        <BrutalCard containerStyle={styles.card}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.foreground} style={{ padding: 32 }} />
          ) : entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="award" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {scope === "friends"
                  ? "No friends on the leaderboard yet."
                  : "No entries yet. Be the first!"}
              </Text>
            </View>
          ) : (
            entries.map((entry: LeaderboardEntry) => (
              <View
                key={entry.walletId}
                style={[
                  styles.entryRow,
                  {
                    borderBottomColor: colors.foreground,
                    backgroundColor: entry.isSelf ? `${colors.foreground}15` : "transparent",
                  },
                ]}
              >
                <View style={styles.rankCol}>
                  <RankIcon rank={entry.rank} colors={colors} />
                </View>
                <View style={styles.entryInfo}>
                  <Text style={[styles.entryName, { color: colors.foreground }]}>
                    {entry.displayName || "Unknown"}
                    {entry.isSelf && (
                      <Text style={[styles.selfBadge, { color: colors.foreground }]}> (You)</Text>
                    )}
                  </Text>
                  <Text style={[styles.entryCode, { color: colors.mutedForeground }]}>
                    {entry.friendCode}
                  </Text>
                </View>
                <View style={styles.scoreCol}>
                  <Text style={[styles.scoreValue, { color: colors.foreground }]}>
                    {entry.score.toLocaleString()}
                  </Text>
                  <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
                    {metric === "coins" ? "coins" : "done"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </BrutalCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Inter_900Black", textTransform: "uppercase", letterSpacing: -1 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
  },
  toggleText: { fontFamily: "Inter_800ExtraBold", fontSize: 13, textTransform: "uppercase" },
  card: { padding: 0, overflow: "hidden" },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  rankCol: { width: 32, alignItems: "center" },
  rankText: { fontSize: 14, fontFamily: "Inter_800ExtraBold" },
  entryInfo: { flex: 1, marginLeft: 12 },
  entryName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  selfBadge: { fontSize: 11, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase" },
  entryCode: { fontSize: 11, fontFamily: "Inter_500Medium" },
  scoreCol: { alignItems: "flex-end" },
  scoreValue: { fontSize: 18, fontFamily: "Inter_900Black" },
  scoreLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
