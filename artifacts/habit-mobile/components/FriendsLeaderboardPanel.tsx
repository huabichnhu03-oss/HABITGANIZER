import {
  getGetFriendProfileQueryKey,
  getGetLeaderboardQueryKey,
  getListFriendsQueryKey,
  getListFriendRequestsQueryKey,
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useGetFriendProfile,
  useGetLeaderboard,
  useListFriendRequests,
  useListFriends,
  usePatchFriendProfile,
  useRemoveFriend,
  useSendFriendRequest,
  GetLeaderboardMetric,
  GetLeaderboardScope,
  type GetLeaderboardParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BrutalCard } from "@/components/BrutalCard";
import { useColors } from "@/hooks/useColors";

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: { data?: { error?: string } };
      data?: { error?: string } | null;
      message?: string;
    };
    const fromBody = e.response?.data?.error ?? e.data?.error;
    if (fromBody) return fromBody;
    return e.message ?? fallback;
  }
  return fallback;
}

function invalidateSocialQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: getGetFriendProfileQueryKey() });
  qc.invalidateQueries({ queryKey: getListFriendRequestsQueryKey() });
  qc.invalidateQueries({ queryKey: getListFriendsQueryKey() });
  qc.invalidateQueries({ queryKey: ["/api/leaderboard"] });
}

const LB_LIMIT = 50;

export function FriendsLeaderboardPanel({ active }: { active: boolean }) {
  const colors = useColors();
  const qc = useQueryClient();

  const profileQ = useGetFriendProfile({
    query: { queryKey: getGetFriendProfileQueryKey(), enabled: active },
  });
  const requestsQ = useListFriendRequests({
    query: { queryKey: getListFriendRequestsQueryKey(), enabled: active },
  });
  const friendsQ = useListFriends({
    query: { queryKey: getListFriendsQueryKey(), enabled: active },
  });

  const [lbScope, setLbScope] = useState<GetLeaderboardParams["scope"]>(GetLeaderboardScope.friends);
  const [lbMetric, setLbMetric] = useState<GetLeaderboardParams["metric"]>(GetLeaderboardMetric.coins);
  const lbParams = useMemo<GetLeaderboardParams>(
    () => ({ scope: lbScope, metric: lbMetric, limit: LB_LIMIT }),
    [lbScope, lbMetric],
  );
  const leaderboardQ = useGetLeaderboard(lbParams, {
    query: { queryKey: getGetLeaderboardQueryKey(lbParams), enabled: active },
  });

  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    if (profileQ.data) setNameDraft(profileQ.data.displayName);
  }, [profileQ.data?.displayName]);

  const [codeDraft, setCodeDraft] = useState("");
  const patchProfile = usePatchFriendProfile();
  const sendReq = useSendFriendRequest();
  const acceptReq = useAcceptFriendRequest();
  const declineReq = useDeclineFriendRequest();
  const cancelReq = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();

  const haptic = () => {
    try {
      void Haptics.selectionAsync();
    } catch {
      /* ignore */
    }
  };

  const onSaveName = () => {
    if (!profileQ.data || patchProfile.isPending) return;
    const trimmed = nameDraft.trim().slice(0, 80);
    if (trimmed === profileQ.data.displayName) return;
    patchProfile.mutate(
      { data: { displayName: trimmed } },
      {
        onSuccess: () => invalidateSocialQueries(qc),
        onError: (err) => Alert.alert("Couldn't update name", errorMessage(err, "Try again")),
      },
    );
  };

  const onSendRequest = () => {
    const raw = codeDraft.trim().toUpperCase();
    if (!raw) {
      Alert.alert("Friend code", "Enter your friend's code first.");
      return;
    }
    sendReq.mutate(
      { data: { friendCode: raw } },
      {
        onSuccess: (res) => {
          setCodeDraft("");
          invalidateSocialQueries(qc);
          if (res.becameFriends) {
            Alert.alert("You're friends!", "They had already sent you a request — you're connected now.");
          } else {
            Alert.alert("Request sent", "They'll see it next time they open the app.");
          }
        },
        onError: (err) => Alert.alert("Request failed", errorMessage(err, "Try again")),
      },
    );
  };

  const onShareCode = async () => {
    const code = profileQ.data?.friendCode;
    if (!code) return;
    try {
      await Share.share({
        message: `Add me on Habiganize! My friend code is ${code}`,
      });
    } catch {
      /* user dismissed */
    }
  };

  if (!active) return null;

  return (
    <View style={{ marginTop: 16, gap: 14 }}>
      {profileQ.isLoading && !profileQ.data ? (
        <ActivityIndicator size="large" color={colors.foreground} style={{ paddingVertical: 24 }} />
      ) : profileQ.isError ? (
        <Text style={[styles.body, { color: colors.destructive }]}>
          {errorMessage(profileQ.error, "Couldn't load your friend profile.")}
        </Text>
      ) : (
        <>
          <BrutalCard background={colors.card} shadowOffset={6}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>YOUR FRIEND CODE</Text>
            <Pressable
              onPress={onShareCode}
              style={[styles.codeBox, { borderColor: colors.foreground, backgroundColor: colors.muted }]}
            >
              <Text style={[styles.codeText, { color: colors.foreground }]}>{profileQ.data?.friendCode}</Text>
              <Text style={[styles.hint, { color: colors.foreground }]}>Tap to share</Text>
            </Pressable>
            <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 14 }]}>DISPLAY NAME</Text>
            <Text style={[styles.hint, { color: colors.foreground, marginBottom: 6 }]}>
              Shown to friends and on the leaderboard.
            </Text>
            <View style={styles.nameRow}>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Your name"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: colors.input,
                    color: colors.foreground,
                  },
                ]}
                maxLength={80}
                autoCapitalize="words"
                autoCorrect
              />
              <Pressable
                onPress={onSaveName}
                disabled={patchProfile.isPending || nameDraft.trim() === (profileQ.data?.displayName ?? "")}
                style={[
                  styles.smallBtn,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: colors.accent,
                    opacity: patchProfile.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.smallBtnLabel, { color: colors.foreground }]}>Save</Text>
              </Pressable>
            </View>
          </BrutalCard>

          <BrutalCard background={colors.secondary} shadowOffset={6}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>ADD A FRIEND</Text>
            <Text style={[styles.hint, { color: colors.foreground, marginBottom: 8 }]}>
              Ask for their code, then enter it here.
            </Text>
            <View style={styles.nameRow}>
              <TextInput
                value={codeDraft}
                onChangeText={(t) => setCodeDraft(t.toUpperCase())}
                placeholder="CODE"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[
                  styles.input,
                  styles.codeInput,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: colors.input,
                    color: colors.foreground,
                  },
                ]}
                maxLength={16}
              />
              <Pressable
                onPress={onSendRequest}
                disabled={sendReq.isPending}
                style={[
                  styles.smallBtn,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: colors.accent,
                    opacity: sendReq.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.smallBtnLabel, { color: colors.foreground }]}>Send</Text>
              </Pressable>
            </View>
          </BrutalCard>

          <BrutalCard background={colors.card} shadowOffset={6}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>REQUESTS</Text>
            {requestsQ.isLoading ? (
              <ActivityIndicator color={colors.foreground} style={{ marginVertical: 12 }} />
            ) : requestsQ.isError ? (
              <Text style={[styles.body, { color: colors.destructive }]}>
                {errorMessage(requestsQ.error, "Couldn't load requests.")}
              </Text>
            ) : (
              <>
                <Text style={[styles.subLabel, { color: colors.foreground }]}>Incoming</Text>
                {(requestsQ.data?.incoming.length ?? 0) === 0 ? (
                  <Text style={[styles.emptyLine, { color: colors.foreground }]}>None right now</Text>
                ) : (
                  requestsQ.data!.incoming.map((r) => (
                    <View key={r.id} style={[styles.reqRow, { borderColor: colors.foreground }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{r.fromDisplayName}</Text>
                        <Text style={[styles.mono, { color: colors.foreground, opacity: 0.7 }]}>{r.fromFriendCode}</Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          acceptReq.mutate(
                            { requestId: r.id },
                            {
                              onSuccess: () => invalidateSocialQueries(qc),
                              onError: (err) => Alert.alert("Accept failed", errorMessage(err, "Try again")),
                            },
                          )
                        }
                        disabled={acceptReq.isPending}
                        style={[styles.miniBtn, { backgroundColor: colors.green, borderColor: colors.foreground }]}
                      >
                        <Text style={[styles.miniBtnText, { color: colors.foreground }]}>Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          declineReq.mutate(
                            { requestId: r.id },
                            {
                              onSuccess: () => invalidateSocialQueries(qc),
                              onError: (err) => Alert.alert("Decline failed", errorMessage(err, "Try again")),
                            },
                          )
                        }
                        disabled={declineReq.isPending}
                        style={[styles.miniBtn, { backgroundColor: colors.muted, borderColor: colors.foreground }]}
                      >
                        <Text style={[styles.miniBtnText, { color: colors.foreground }]}>Decline</Text>
                      </Pressable>
                    </View>
                  ))
                )}
                <Text style={[styles.subLabel, { color: colors.foreground, marginTop: 12 }]}>Outgoing</Text>
                {(requestsQ.data?.outgoing.length ?? 0) === 0 ? (
                  <Text style={[styles.emptyLine, { color: colors.foreground }]}>None pending</Text>
                ) : (
                  requestsQ.data!.outgoing.map((r) => (
                    <View key={r.id} style={[styles.reqRow, { borderColor: colors.foreground }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.foreground }]}>{r.toDisplayName}</Text>
                        <Text style={[styles.mono, { color: colors.foreground, opacity: 0.7 }]}>{r.toFriendCode}</Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          cancelReq.mutate(
                            { requestId: r.id },
                            {
                              onSuccess: () => invalidateSocialQueries(qc),
                              onError: (err) => Alert.alert("Cancel failed", errorMessage(err, "Try again")),
                            },
                          )
                        }
                        disabled={cancelReq.isPending}
                        style={[styles.miniBtn, { backgroundColor: colors.muted, borderColor: colors.foreground }]}
                      >
                        <Text style={[styles.miniBtnText, { color: colors.foreground }]}>Cancel</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </>
            )}
          </BrutalCard>

          <BrutalCard background={colors.card} shadowOffset={6}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>FRIENDS</Text>
            {friendsQ.isLoading ? (
              <ActivityIndicator color={colors.foreground} style={{ marginVertical: 12 }} />
            ) : friendsQ.isError ? (
              <Text style={[styles.body, { color: colors.destructive }]}>
                {errorMessage(friendsQ.error, "Couldn't load friends.")}
              </Text>
            ) : (friendsQ.data?.length ?? 0) === 0 ? (
              <Text style={[styles.emptyLine, { color: colors.foreground }]}>
                No friends yet — add someone by code above.
              </Text>
            ) : (
              friendsQ.data!.map((f) => (
                <View key={f.walletId} style={[styles.friendRow, { borderColor: colors.foreground }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{f.displayName}</Text>
                    <Text style={[styles.mono, { color: colors.foreground, opacity: 0.65 }]}>{f.friendCode}</Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Remove friend?", `Remove ${f.displayName}?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Remove",
                          style: "destructive",
                          onPress: () =>
                            removeFriend.mutate(
                              { walletId: f.walletId },
                              {
                                onSuccess: () => invalidateSocialQueries(qc),
                                onError: (err) => Alert.alert("Remove failed", errorMessage(err, "Try again")),
                              },
                            ),
                        },
                      ])
                    }
                    disabled={removeFriend.isPending}
                    style={[styles.miniBtn, { backgroundColor: colors.destructive, borderColor: colors.foreground }]}
                  >
                    <Text style={[styles.miniBtnText, { color: colors.destructiveForeground }]}>Remove</Text>
                  </Pressable>
                </View>
              ))
            )}
          </BrutalCard>

          <BrutalCard background={colors.primary} shadowOffset={6}>
            <Text style={[styles.sectionLabel, { color: colors.primaryForeground }]}>LEADERBOARD</Text>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => {
                  haptic();
                  setLbScope(GetLeaderboardScope.friends);
                }}
                style={[
                  styles.toggle,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: lbScope === GetLeaderboardScope.friends ? colors.accent : colors.card,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: colors.foreground }]}>Friends</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic();
                  setLbScope(GetLeaderboardScope.global);
                }}
                style={[
                  styles.toggle,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: lbScope === GetLeaderboardScope.global ? colors.accent : colors.card,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: colors.foreground }]}>Global</Text>
              </Pressable>
            </View>
            <View style={[styles.toggleRow, { marginTop: 8 }]}>
              <Pressable
                onPress={() => {
                  haptic();
                  setLbMetric(GetLeaderboardMetric.coins);
                }}
                style={[
                  styles.toggle,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: lbMetric === GetLeaderboardMetric.coins ? colors.accent : colors.card,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: colors.foreground }]}>Coins</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic();
                  setLbMetric(GetLeaderboardMetric.completions);
                }}
                style={[
                  styles.toggle,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: lbMetric === GetLeaderboardMetric.completions ? colors.accent : colors.card,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: colors.foreground }]}>Completions</Text>
              </Pressable>
            </View>

            {leaderboardQ.isLoading ? (
              <ActivityIndicator color={colors.primaryForeground} style={{ marginVertical: 16 }} />
            ) : leaderboardQ.isError ? (
              <Text style={[styles.body, { color: colors.primaryForeground, marginTop: 8 }]}>
                {errorMessage(leaderboardQ.error, "Couldn't load leaderboard.")}
              </Text>
            ) : (leaderboardQ.data?.entries.length ?? 0) === 0 ? (
              <Text style={[styles.emptyLine, { color: colors.primaryForeground, marginTop: 8 }]}>
                No entries yet for this view.
              </Text>
            ) : (
              <View style={{ marginTop: 12, gap: 8 }}>
                {leaderboardQ.data!.entries.map((e) => (
                  <View
                    key={e.walletId}
                    style={[
                      styles.lbRow,
                      {
                        borderColor: colors.foreground,
                        backgroundColor: e.isSelf ? colors.accent : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.rank, { color: colors.foreground }]}>{e.rank}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                        {e.displayName}
                        {e.isSelf ? " (you)" : ""}
                      </Text>
                      <Text style={[styles.mono, { color: colors.foreground, opacity: 0.65 }]}>{e.friendCode}</Text>
                    </View>
                    <Text style={[styles.score, { color: colors.foreground }]}>{e.score}</Text>
                  </View>
                ))}
              </View>
            )}
          </BrutalCard>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontFamily: "Inter_900Black", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  subLabel: { fontFamily: "Inter_700Bold", fontSize: 12, marginBottom: 6 },
  body: { fontFamily: "Inter_500Medium", fontSize: 14 },
  hint: { fontFamily: "Inter_500Medium", fontSize: 12, opacity: 0.72 },
  codeBox: { paddingVertical: 14, paddingHorizontal: 12, borderWidth: 3, borderRadius: 12, alignItems: "center" },
  codeText: { fontFamily: "Inter_900Black", fontSize: 22, letterSpacing: 4 },
  nameRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: { flex: 1, borderWidth: 3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  codeInput: { letterSpacing: 2 },
  smallBtn: { paddingVertical: 10, paddingHorizontal: 14, borderWidth: 3, borderRadius: 12 },
  smallBtnLabel: { fontFamily: "Inter_900Black", fontSize: 12, letterSpacing: 0.8 },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderRadius: 12,
    marginBottom: 8,
  },
  rowTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  mono: { fontFamily: "Inter_500Medium", fontSize: 12 },
  miniBtn: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 2, borderRadius: 10 },
  miniBtnText: { fontFamily: "Inter_800ExtraBold", fontSize: 11 },
  emptyLine: { fontFamily: "Inter_500Medium", fontSize: 14, opacity: 0.75, marginVertical: 6 },
  toggleRow: { flexDirection: "row", gap: 10 },
  toggle: { flex: 1, paddingVertical: 10, borderWidth: 3, borderRadius: 12, alignItems: "center" },
  toggleText: { fontFamily: "Inter_800ExtraBold", fontSize: 12, letterSpacing: 0.6 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 3, borderRadius: 12 },
  rank: { fontFamily: "Inter_900Black", fontSize: 16, width: 28, textAlign: "center" },
  score: { fontFamily: "Inter_900Black", fontSize: 15, minWidth: 52, textAlign: "right" },
});
