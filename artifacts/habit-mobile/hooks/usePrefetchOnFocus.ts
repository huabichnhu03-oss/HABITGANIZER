import { useFocusEffect } from "expo-router";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  getCollection,
  getDashboard,
  getFriendProfile,
  getHealthSummary,
  getLeaderboard,
  getWallet,
  listFriendRequests,
  listFriends,
  listHabits,
  listShop,
  getGetCollectionQueryKey,
  getGetDashboardQueryKey,
  getGetFriendProfileQueryKey,
  getGetHealthSummaryQueryKey,
  getGetLeaderboardQueryKey,
  getGetWalletQueryKey,
  getListFriendsQueryKey,
  getListFriendRequestsQueryKey,
  getListHabitsQueryKey,
  getListShopQueryKey,
  GetLeaderboardMetric,
  GetLeaderboardScope,
} from "@workspace/api-client-react";
import { useCallback } from "react";

type TabKey = "today" | "habits" | "stats" | "history" | "pups" | "health" | "friends" | "leaderboard";

const SIBLINGS: Record<TabKey, TabKey[]> = {
  today: ["habits", "stats", "health", "pups", "friends"],
  habits: ["today", "stats", "health", "pups", "friends"],
  stats: ["today", "habits", "history", "health", "pups", "friends"],
  history: ["today", "habits", "stats", "health", "pups", "friends"],
  health: ["today", "habits", "stats", "pups", "friends"],
  pups: ["today", "habits", "stats", "health", "friends", "leaderboard"],
  friends: ["today", "habits", "stats", "pups", "leaderboard"],
  leaderboard: ["friends", "pups"],
};

type Prefetch = { key: QueryKey; fn: (signal?: AbortSignal) => Promise<unknown> };

const TAB_QUERIES: Record<TabKey, Prefetch[]> = {
  today: [
    { key: getListHabitsQueryKey(), fn: (signal) => listHabits(undefined, { signal }) },
    { key: getGetWalletQueryKey(), fn: (signal) => getWallet({ signal }) },
  ],
  habits: [
    { key: getListHabitsQueryKey(), fn: (signal) => listHabits(undefined, { signal }) },
  ],
  stats: [
    { key: getGetDashboardQueryKey(), fn: (signal) => getDashboard({ signal }) },
    { key: getListHabitsQueryKey(), fn: (signal) => listHabits(undefined, { signal }) },
  ],
  health: [
    { key: getGetHealthSummaryQueryKey(), fn: (signal) => getHealthSummary({ signal }) },
  ],
  history: [
    { key: getListHabitsQueryKey(), fn: (signal) => listHabits(undefined, { signal }) },
  ],
  pups: [
    { key: getListShopQueryKey(), fn: (signal) => listShop({ signal }) },
    { key: getGetCollectionQueryKey(), fn: (signal) => getCollection({ signal }) },
    { key: getGetWalletQueryKey(), fn: (signal) => getWallet({ signal }) },
  ],
  friends: [
    { key: getGetFriendProfileQueryKey(), fn: (signal) => getFriendProfile({ signal }) },
    { key: getListFriendRequestsQueryKey(), fn: (signal) => listFriendRequests({ signal }) },
    { key: getListFriendsQueryKey(), fn: (signal) => listFriends({ signal }) },
  ],
  leaderboard: [
    {
      key: getGetLeaderboardQueryKey({
        scope: GetLeaderboardScope.friends,
        metric: GetLeaderboardMetric.coins,
        limit: 50,
      }),
      fn: (signal) =>
        getLeaderboard(
          { scope: GetLeaderboardScope.friends, metric: GetLeaderboardMetric.coins, limit: 50 },
          { signal },
        ),
    },
  ],
};

export function usePrefetchOnFocus(currentTab: TabKey) {
  const qc = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      const seen = new Set<string>();
      for (const tab of SIBLINGS[currentTab]) {
        for (const { key, fn } of TAB_QUERIES[tab]) {
          const id = JSON.stringify(key);
          if (seen.has(id)) continue;
          seen.add(id);
          qc.prefetchQuery({ queryKey: key, queryFn: ({ signal }) => fn(signal) });
        }
      }
    }, [qc, currentTab]),
  );
}
