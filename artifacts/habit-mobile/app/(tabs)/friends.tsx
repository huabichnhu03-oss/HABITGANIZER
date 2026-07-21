import { Feather } from "@expo/vector-icons";
import {
  useGetFriendProfile,
  usePatchFriendProfile,
  useListFriendRequests,
  useListFriends,
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useCancelFriendRequest,
  useRemoveFriend,
  type FriendRequestItem,
  type FriendSummary,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalCard } from "@/components/BrutalCard";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";

export default function FriendsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  usePrefetchOnFocus("friends");

  const profileQuery = useGetFriendProfile();
  const requestsQuery = useListFriendRequests();
  const friendsQuery = useListFriends();

  const [addCode, setAddCode] = useState("");
  const [editName, setEditName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);

  const patchProfile = usePatchFriendProfile({
    mutation: {
      onSuccess: () => {
        Alert.alert("Display name updated");
        setIsEditingName(false);
        profileQuery.refetch();
      },
    },
  });

  const sendRequest = useSendFriendRequest({
    mutation: {
      onSuccess: (data) => {
        if (data.becameFriends) {
          Alert.alert("You're now friends!");
        } else {
          Alert.alert("Friend request sent");
        }
        setAddCode("");
        requestsQuery.refetch();
        friendsQuery.refetch();
      },
      onError: () => {
        Alert.alert("Could not send request", "Check the friend code and try again.");
      },
    },
  });

  const acceptRequest = useAcceptFriendRequest({
    mutation: {
      onSuccess: () => {
        Alert.alert("Friend request accepted!");
        requestsQuery.refetch();
        friendsQuery.refetch();
      },
    },
  });

  const declineRequest = useDeclineFriendRequest({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
      },
    },
  });

  const cancelRequest = useCancelFriendRequest({
    mutation: {
      onSuccess: () => {
        requestsQuery.refetch();
      },
    },
  });

  const removeFriend = useRemoveFriend({
    mutation: {
      onSuccess: () => {
        Alert.alert("Friend removed");
        friendsQuery.refetch();
      },
    },
  });

  const isLoading = profileQuery.isLoading || requestsQuery.isLoading || friendsQuery.isLoading;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>Couldn't load profile</Text>
      </View>
    );
  }

  const requestsSummary = requestsQuery.data ?? { incoming: [], outgoing: [] };
  const friends = friendsQuery.data ?? [];
  const incoming = requestsSummary.incoming;
  const outgoing = requestsSummary.outgoing;

  function handleCopyCode() {
    if (!profile) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(profile.friendCode);
      Alert.alert("Friend code copied!");
    } else {
      Alert.alert("Friend Code", profile.friendCode);
    }
  }

  function handleSendRequest() {
    const code = addCode.trim().toUpperCase();
    if (!code) return;
    sendRequest.mutate({ data: { friendCode: code } });
  }

  function handleSaveName() {
    const name = editName.trim();
    if (!name) return;
    patchProfile.mutate({ data: { displayName: name } });
  }

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
          <Feather name="users" size={28} color={colors.foreground} />
          <Text style={[styles.title, { color: colors.foreground }]}>Friends</Text>
        </View>

        {/* Your Profile Card */}
        <BrutalCard containerStyle={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your Profile</Text>
            <Pressable
              onPress={() => {
                setEditName(profile.displayName);
                setIsEditingName(!isEditingName);
              }}
            >
              <Text style={[styles.editBtn, { color: colors.mutedForeground }]}>
                {isEditingName ? "Cancel" : "Edit Name"}
              </Text>
            </Pressable>
          </View>

          {isEditingName ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.foreground, backgroundColor: colors.background }]}
                value={editName}
                onChangeText={setEditName}
                maxLength={80}
                placeholder="Display name"
                placeholderTextColor={colors.mutedForeground}
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.foreground }]}
                onPress={handleSaveName}
                disabled={patchProfile.isPending}
              >
                <Text style={[styles.btnText, { color: colors.background }]}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.displayName, { color: colors.foreground }]}>
              {profile.displayName || "No name set"}
            </Text>
          )}

          <View style={styles.codeRow}>
            <View style={[styles.codeBox, { borderColor: colors.foreground, backgroundColor: colors.muted }]}>
              <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>FRIEND CODE</Text>
              <Text style={[styles.codeValue, { color: colors.foreground }]}>{profile.friendCode}</Text>
            </View>
            <Pressable
              style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.foreground }]}
              onPress={handleCopyCode}
            >
              <Feather name="copy" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </BrutalCard>

        {/* Add Friend */}
        <BrutalCard containerStyle={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Add Friend
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, styles.codeInput, { color: colors.foreground, borderColor: colors.foreground, backgroundColor: colors.background }]}
              value={addCode}
              onChangeText={(t) => setAddCode(t.toUpperCase())}
              maxLength={10}
              placeholder="Enter friend code"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
            />
            <Pressable
              style={[styles.btn, { backgroundColor: colors.foreground }, (!addCode.trim() || sendRequest.isPending) && styles.btnDisabled]}
              onPress={handleSendRequest}
              disabled={sendRequest.isPending || !addCode.trim()}
            >
              <Text style={[styles.btnText, { color: colors.background }]}>
                {sendRequest.isPending ? "Sending..." : "Send"}
              </Text>
            </Pressable>
          </View>
        </BrutalCard>

        {/* Incoming Requests */}
        {incoming.length > 0 && (
          <BrutalCard containerStyle={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Incoming Requests ({incoming.length})
            </Text>
            {incoming.map((req: FriendRequestItem) => (
              <View key={req.id} style={[styles.listItem, { borderColor: colors.foreground }]}>
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemName, { color: colors.foreground }]}>
                    {req.fromDisplayName || "Unknown"}
                  </Text>
                  <Text style={[styles.listItemCode, { color: colors.mutedForeground }]}>
                    {req.fromFriendCode}
                  </Text>
                </View>
                <View style={styles.listItemActions}>
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: "#22c55e" }]}
                    onPress={() => acceptRequest.mutate({ requestId: req.id })}
                    disabled={acceptRequest.isPending}
                  >
                    <Feather name="check" size={16} color="#fff" />
                  </Pressable>
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: colors.destructive }]}
                    onPress={() => declineRequest.mutate({ requestId: req.id })}
                    disabled={declineRequest.isPending}
                  >
                    <Feather name="x" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </BrutalCard>
        )}

        {/* Outgoing Requests */}
        {outgoing.length > 0 && (
          <BrutalCard containerStyle={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Pending Sent ({outgoing.length})
            </Text>
            {outgoing.map((req: FriendRequestItem) => (
              <View key={req.id} style={[styles.listItem, { borderColor: colors.foreground }]}>
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemName, { color: colors.foreground }]}>
                    {req.toDisplayName || "Unknown"}
                  </Text>
                  <Text style={[styles.listItemCode, { color: colors.mutedForeground }]}>
                    {req.toFriendCode}
                  </Text>
                </View>
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: colors.card, borderColor: colors.foreground, borderWidth: 2 }]}
                  onPress={() => cancelRequest.mutate({ requestId: req.id })}
                  disabled={cancelRequest.isPending}
                >
                  <Text style={[styles.smallBtnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </BrutalCard>
        )}

        {/* Friends List */}
        <BrutalCard containerStyle={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Your Friends ({friends.length})
          </Text>
          {friends.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No friends yet. Share your friend code or add someone above!
            </Text>
          ) : (
            friends.map((f: FriendSummary) => (
              <View key={f.walletId} style={[styles.listItem, { borderColor: colors.foreground }]}>
                <View style={styles.listItemText}>
                  <Text style={[styles.listItemName, { color: colors.foreground }]}>
                    {f.displayName || "Unknown"}
                  </Text>
                  <Text style={[styles.listItemCode, { color: colors.mutedForeground }]}>
                    {f.friendCode}
                  </Text>
                </View>
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: colors.card, borderColor: colors.foreground, borderWidth: 2 }]}
                  onPress={() => {
                    Alert.alert("Remove Friend", `Remove ${f.displayName || "this friend"}?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Remove",
                        style: "destructive",
                        onPress: () => removeFriend.mutate({ walletId: f.walletId }),
                      },
                    ]);
                  }}
                  disabled={removeFriend.isPending}
                >
                  <Feather name="user-minus" size={16} color={colors.foreground} />
                </Pressable>
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Inter_900Black", textTransform: "uppercase", letterSpacing: -1 },
  card: { marginBottom: 16, padding: 16 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 18, fontFamily: "Inter_800ExtraBold", textTransform: "uppercase", marginBottom: 12 },
  editBtn: { fontSize: 14, fontFamily: "Inter_700Bold" },
  displayName: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  editRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: { flex: 1, borderWidth: 2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_600SemiBold", fontSize: 14 },
  codeInput: { fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase" },
  codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  codeBox: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 12, borderStyle: "dashed" },
  codeLabel: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", marginBottom: 4 },
  codeValue: { fontSize: 24, fontFamily: "Inter_900Black", letterSpacing: 4 },
  iconBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  addRow: { flexDirection: "row", gap: 8 },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontFamily: "Inter_800ExtraBold", fontSize: 14, textTransform: "uppercase" },
  listItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
  listItemText: { flex: 1 },
  listItemName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  listItemCode: { fontSize: 12, fontFamily: "Inter_500Medium" },
  listItemActions: { flexDirection: "row", gap: 8 },
  smallBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  smallBtnText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center", paddingVertical: 24 },
  errorText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
