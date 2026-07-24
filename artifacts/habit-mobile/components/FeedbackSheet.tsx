import { Feather } from "@expo/vector-icons";
import { customFetch } from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const MESSAGE_MAX = 2000;

type FeedbackSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackSheet({ open, onClose }: FeedbackSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(null);
    setMessage("");
    setBusy(false);
    setError(null);
    setSent(false);
  }, [open]);

  const canSubmit = Boolean(message.trim()) || rating != null;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await customFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          rating,
          source: "settings",
          platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
        }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.foreground,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>Send feedback</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Ideas, bugs, or what’s working well — we read every note.
          </Text>

          {sent ? (
            <View style={styles.sentWrap}>
              <Text style={[styles.sentTitle, { color: colors.foreground }]}>Thanks!</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Your feedback helps us improve Habiganize.
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  styles.primaryBtn,
                  { borderColor: colors.foreground, backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.primaryForeground ?? "#fff" }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.label, { color: colors.foreground }]}>Rating (optional)</Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = rating != null && value <= rating;
                  return (
                    <Pressable
                      key={value}
                      testID={`feedback-star-${value}`}
                      onPress={() => setRating((prev) => (prev === value ? null : value))}
                      style={[
                        styles.starBtn,
                        {
                          borderColor: colors.foreground,
                          backgroundColor: active ? colors.accent : colors.card,
                        },
                      ]}
                    >
                      <Feather
                        name="star"
                        size={20}
                        color={active ? colors.foreground : colors.mutedForeground}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Your message</Text>
              <TextInput
                testID="feedback-message"
                value={message}
                onChangeText={setMessage}
                maxLength={MESSAGE_MAX}
                multiline
                numberOfLines={5}
                placeholder="What’s on your mind?"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    borderColor: colors.foreground,
                    color: colors.foreground,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              {error ? (
                <Text style={[styles.error, { color: colors.destructive ?? "#b91c1c" }]}>{error}</Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable
                  onPress={onClose}
                  style={[styles.secondaryBtn, { borderColor: colors.foreground, backgroundColor: colors.card }]}
                >
                  <Text style={[styles.secondaryText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  testID="feedback-submit"
                  onPress={() => void submit()}
                  disabled={!canSubmit || busy}
                  style={[
                    styles.primaryBtn,
                    {
                      flex: 1,
                      borderColor: colors.foreground,
                      backgroundColor: colors.primary,
                      opacity: !canSubmit || busy ? 0.55 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primaryForeground ?? "#fff"} />
                  ) : (
                    <Text style={[styles.primaryText, { color: colors.primaryForeground ?? "#fff" }]}>
                      Send
                    </Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20, 20, 20, 0.55)",
  },
  sheet: {
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 20,
    letterSpacing: -0.3,
    textTransform: "uppercase",
  },
  hint: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  label: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  stars: { flexDirection: "row", gap: 8 },
  starBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 2.5,
    borderRadius: 14,
    minHeight: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlignVertical: "top",
  },
  error: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  secondaryBtn: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontFamily: "Inter_900Black",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  primaryBtn: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sentWrap: { gap: 10, paddingVertical: 8 },
  sentTitle: {
    fontFamily: "Inter_900Black",
    fontSize: 22,
    textTransform: "uppercase",
  },
});
