import { useSignIn, useSignUp } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
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
import { API_URL } from "@/lib/config";

type Mode = "sign-in" | "sign-up";
type SignUpStep = "form" | "verify";

// ─── Sign-in panel ──────────────────────────────────────────────────────────

function SignInPanel({ colors, onSwitch }: { colors: ReturnType<typeof useColors>; onSwitch: () => void }) {
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (fetchStatus === "fetching") return;
    setError(null);
    const { error: err } = await signIn.password({ identifier: email, password });
    if (err) {
      setError(err.message ?? "Invalid email or password.");
      return;
    }
    await signIn.finalize({ navigate: () => {} });
  };

  const loading = fetchStatus === "fetching";

  return (
    <>
      <Text style={[styles.heading, { color: colors.foreground }]}>Welcome back</Text>
      <View style={[styles.tabs, { borderColor: colors.foreground }]}>
        <View style={[styles.tab, { backgroundColor: colors.card, borderRightWidth: 3, borderColor: colors.foreground }]}>
          <Text style={[styles.tabText, { color: colors.foreground }]}>Log In</Text>
        </View>
        <Pressable onPress={onSwitch} style={[styles.tab, { backgroundColor: colors.primary }]}>
          <Text style={[styles.tabText, { color: colors.primaryForeground, opacity: 0.7 }]}>Sign Up</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="Your password"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background }]}
        />
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: "#dc2626", backgroundColor: "#dc262622" }]}>
          <Text style={[styles.errorText, { color: "#dc2626" }]}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={loading}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: colors.primary, borderColor: colors.foreground, opacity: loading ? 0.6 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
        ]}
      >
        {loading ? <ActivityIndicator color={colors.primaryForeground} /> : (
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Log In</Text>
        )}
      </Pressable>
    </>
  );
}

// ─── Sign-up panel ───────────────────────────────────────────────────────────

function SignUpPanel({ colors, onSwitch }: { colors: ReturnType<typeof useColors>; onSwitch: () => void }) {
  const { signUp, fetchStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<SignUpStep>("form");
  const [error, setError] = useState<string | null>(null);

  const loading = fetchStatus === "fetching";

  const submitForm = async () => {
    if (loading) return;
    setError(null);
    const { error: err } = await signUp.password({ emailAddress: email, password });
    if (err) { setError(err.message ?? "Could not create account."); return; }
    await signUp.verifications.sendEmailCode();
    setStep("verify");
  };

  const verify = async () => {
    if (loading) return;
    setError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: () => {} });
    } else {
      setError("Verification incomplete — please try again.");
    }
  };

  if (step === "verify") {
    return (
      <>
        <Text style={[styles.heading, { color: colors.foreground }]}>Check your email</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          We sent a 6-digit code to {email}
        </Text>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>Verification Code</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="numeric"
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background, letterSpacing: 4, fontSize: 22 }]}
          />
        </View>
        {error ? (
          <View style={[styles.errorBox, { borderColor: "#dc2626", backgroundColor: "#dc262622" }]}>
            <Text style={[styles.errorText, { color: "#dc2626" }]}>{error}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={verify}
          disabled={loading}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: colors.primary, borderColor: colors.foreground, opacity: loading ? 0.6 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
          ]}
        >
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Verify</Text>
          )}
        </Pressable>
        <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.resend}>
          <Text style={[styles.resendText, { color: colors.mutedForeground }]}>Resend code</Text>
        </Pressable>
      </>
    );
  }

  return (
    <>
      <Text style={[styles.heading, { color: colors.foreground }]}>Create account</Text>
      <View style={[styles.tabs, { borderColor: colors.foreground }]}>
        <Pressable onPress={onSwitch} style={[styles.tab, { backgroundColor: colors.card, borderRightWidth: 3, borderColor: colors.foreground }]}>
          <Text style={[styles.tabText, { color: colors.foreground, opacity: 0.7 }]}>Log In</Text>
        </Pressable>
        <View style={[styles.tab, { backgroundColor: colors.primary }]}>
          <Text style={[styles.tabText, { color: colors.primaryForeground }]}>Sign Up</Text>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="At least 8 characters"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { borderColor: colors.foreground, color: colors.foreground, backgroundColor: colors.background }]}
        />
      </View>

      {error ? (
        <View style={[styles.errorBox, { borderColor: "#dc2626", backgroundColor: "#dc262622" }]}>
          <Text style={[styles.errorText, { color: "#dc2626" }]}>{error}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={submitForm}
        disabled={loading}
        style={({ pressed }) => [
          styles.submit,
          { backgroundColor: colors.primary, borderColor: colors.foreground, opacity: loading ? 0.6 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
        ]}
      >
        {loading ? <ActivityIndicator color={colors.primaryForeground} /> : (
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Create Account</Text>
        )}
      </Pressable>
      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Your data is synced across all your devices.
      </Text>
    </>
  );
}

// ─── Root auth screen ────────────────────────────────────────────────────────

export function ClerkAuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("sign-up");

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Feather name="star" size={28} color={colors.foreground} />
          <Text style={[styles.brandText, { color: colors.foreground }]}>HABIGANIZE</Text>
        </View>

        <BrutalCard background={colors.card} containerStyle={styles.card} shadowOffset={7}>
          {mode === "sign-in"
            ? <SignInPanel colors={colors} onSwitch={() => setMode("sign-up")} />
            : <SignUpPanel colors={colors} onSwitch={() => setMode("sign-in")} />
          }
        </BrutalCard>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(`${API_URL}/privacy`)}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy</Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.mutedForeground }]}> · </Text>
          <Pressable onPress={() => Linking.openURL(`${API_URL}/support`)}>
            <Text style={[styles.legalLink, { color: colors.primary }]}>Support</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 18 },
  brandText: { fontFamily: "Inter_900Black", fontSize: 22, letterSpacing: -0.5 },
  card: { padding: 0 },
  heading: { fontFamily: "Inter_900Black", fontSize: 22, padding: 20, paddingBottom: 12 },
  subheading: { fontFamily: "Inter_700Bold", fontSize: 14, paddingHorizontal: 20, paddingBottom: 4 },
  tabs: { flexDirection: "row", borderTopWidth: 3, borderBottomWidth: 3 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontFamily: "Inter_900Black", fontSize: 13, letterSpacing: 0.6, textTransform: "uppercase" },
  field: { paddingHorizontal: 20, marginTop: 14 },
  label: { fontFamily: "Inter_900Black", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 },
  input: { borderWidth: 3, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontFamily: "Inter_700Bold", fontSize: 16 },
  errorBox: { marginHorizontal: 20, marginTop: 14, padding: 10, borderWidth: 2, borderRadius: 12 },
  errorText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  submit: { margin: 20, marginTop: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 3, alignItems: "center" },
  submitText: { fontFamily: "Inter_900Black", fontSize: 15, letterSpacing: 0.6, textTransform: "uppercase" },
  note: { fontFamily: "Inter_700Bold", fontSize: 11, textAlign: "center", paddingBottom: 16 },
  resend: { alignItems: "center", paddingBottom: 16 },
  resendText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  legalLink: { fontFamily: "Inter_700Bold", fontSize: 12, textDecorationLine: "underline" },
  legalDot: { fontFamily: "Inter_700Bold", fontSize: 12 },
});
