import { Feather } from "@expo/vector-icons";
import { useClerk, useUser } from "@clerk/expo";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

type ManageLink = {
  href: "/(tabs)/friends" | "/(tabs)/history" | "/(tabs)/leaderboard";
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  testId: string;
};

const MANAGE_LINKS: ManageLink[] = [
  {
    href: "/(tabs)/friends",
    label: "Friends",
    description: "Friend code, requests, and your circle",
    icon: "users",
    testId: "settings-link-friends",
  },
  {
    href: "/(tabs)/history",
    label: "History",
    description: "Past completions and calendar",
    icon: "clock",
    testId: "settings-link-history",
  },
  {
    href: "/(tabs)/leaderboard",
    label: "Ranks",
    description: "Friends and global leaderboards",
    icon: "award",
    testId: "settings-link-ranks",
  },
];

type MetaShape = Record<string, unknown>;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { signOut } = useClerk();
  const { user } = useUser();

  const [firstName, setFirstName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    const meta = (user.unsafeMetadata ?? {}) as MetaShape;
    setFirstName(user.firstName ?? "");
    setBirthday(typeof meta.birthday === "string" ? meta.birthday : "");
    setPhone(typeof meta.phone === "string" ? meta.phone : "");
    setBio(typeof meta.bio === "string" ? meta.bio : "");
  }, [user]);

  const meta = (user?.unsafeMetadata ?? {}) as MetaShape;

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  const confirmSignOut = () => {
    Alert.alert("Sign out?", "You can log back in anytime.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  };

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await user.update({
        firstName: firstName.trim() || undefined,
        unsafeMetadata: {
          ...meta,
          birthday: birthday || null,
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        },
      });
      setEditingProfile(false);
      Alert.alert("Profile saved");
    } catch (err) {
      Alert.alert(
        "Couldn’t save profile",
        err instanceof Error ? err.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

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
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          testID="settings-back"
          style={[styles.backBtn, { borderColor: colors.foreground, backgroundColor: colors.card }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.appBarTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        alwaysBounceVertical={false}
      >
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Manage
        </Text>
        <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
          Friends and other tools live here so they’re easy to find on mobile.
        </Text>

        <View style={styles.linkList}>
          {MANAGE_LINKS.map((item) => (
            <Pressable
              key={item.href}
              testID={item.testId}
              onPress={() => router.push(item.href)}
              style={({ pressed }) => [
                styles.linkRow,
                {
                  borderColor: colors.foreground,
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.linkIcon,
                  { borderColor: colors.foreground, backgroundColor: colors.accent },
                ]}
              >
                <Feather name={item.icon} size={20} color={colors.foreground} />
              </View>
              <View style={styles.linkText}>
                <Text style={[styles.linkLabel, { color: colors.foreground }]}>{item.label}</Text>
                <Text style={[styles.linkDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>
          Your profile
        </Text>

        <BrutalCard containerStyle={{ marginTop: 8 }}>
          <View style={styles.profileHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.emailLabel, { color: colors.mutedForeground }]}>Signed in</Text>
              <Text style={[styles.emailValue, { color: colors.foreground }]} numberOfLines={1}>
                {email ?? "No email on file"}
              </Text>
            </View>
            <Pressable
              onPress={() => setEditingProfile((v) => !v)}
              testID="settings-toggle-profile"
              style={[styles.editBtn, { borderColor: colors.foreground, backgroundColor: colors.accent }]}
            >
              <Text style={[styles.editBtnText, { color: colors.foreground }]}>
                {editingProfile ? "Close" : "Edit"}
              </Text>
            </Pressable>
          </View>

          {editingProfile ? (
            <View style={styles.form}>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Preferred name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                maxLength={50}
                placeholder="What should we call you?"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Birthday (optional)</Text>
              <TextInput
                value={birthday}
                onChangeText={setBirthday}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Phone (optional)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                maxLength={32}
                keyboardType="phone-pad"
                placeholder="+1 …"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Short note (optional)</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                maxLength={280}
                multiline
                numberOfLines={3}
                placeholder="A line about your goals"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  styles.textarea,
                  { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background },
                ]}
              />
              <Pressable
                onPress={() => void saveProfile()}
                disabled={busy || !user}
                testID="settings-save-profile"
                style={[
                  styles.saveBtn,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: colors.primary,
                    opacity: busy ? 0.6 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground ?? "#fff"} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.primaryForeground ?? "#fff" }]}>
                    Save profile
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.profileHint, { color: colors.mutedForeground }]}>
              {user?.firstName
                ? `Hi ${user.firstName} — tap Edit to update your name, birthday, and more.`
                : "Tap Edit to set your preferred name and profile details."}
            </Text>
          )}
        </BrutalCard>

        <Pressable
          onPress={confirmSignOut}
          testID="settings-sign-out"
          style={[
            styles.signOutBtn,
            { borderColor: colors.foreground, backgroundColor: colors.card },
          ]}
        >
          <Feather name="log-out" size={16} color={colors.foreground} />
          <Text style={[styles.signOutText, { color: colors.foreground }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 3,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitle: {
    fontFamily: "Inter_900Black",
    fontSize: 18,
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  linkList: { gap: 10 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2.5,
    borderRadius: 14,
    padding: 12,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { flex: 1, minWidth: 0 },
  linkLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  linkDesc: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emailLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  emailValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    marginTop: 2,
  },
  editBtn: {
    borderWidth: 2.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBtnText: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  profileHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 12,
    lineHeight: 18,
  },
  form: { marginTop: 14, gap: 8 },
  fieldLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  input: {
    borderWidth: 2.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveBtn: {
    marginTop: 8,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  signOutBtn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 14,
  },
  signOutText: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
