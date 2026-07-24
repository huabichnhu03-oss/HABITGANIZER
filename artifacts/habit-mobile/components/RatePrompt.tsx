import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  markFeedbackPromptShown,
  shouldShowFeedbackPrompt,
} from "@/lib/feedback-prompt-storage";
import { requestAppRating } from "@/lib/request-app-rating";

const SHOW_DELAY_MS = 2500;

/**
 * Every 15 days, ask signed-in native users to rate Habiganize in the store.
 */
export function RatePrompt() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (Platform.OS === "web") return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const show = await shouldShowFeedbackPrompt(user.id);
        if (cancelled || !show) return;
        await markFeedbackPromptShown(user.id);
        if (!cancelled) setOpen(true);
      })();
    }, SHOW_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isLoaded, user]);

  const dismiss = () => setOpen(false);

  const rate = () => {
    setOpen(false);
    void requestAppRating();
  };

  if (!isLoaded || !user || Platform.OS === "web") return null;

  const storeLabel = Platform.OS === "ios" ? "App Store" : "Play Store";

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + 24, paddingTop: insets.top + 24 }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.foreground,
            },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { borderColor: colors.foreground, backgroundColor: colors.accent },
            ]}
          >
            <Feather name="star" size={28} color={colors.foreground} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Enjoying Habiganize?</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            A quick rating on the {storeLabel} helps more people find us — and means a lot to the
            team.
          </Text>

          <Pressable
            testID="rate-prompt-yes"
            onPress={rate}
            style={[
              styles.primaryBtn,
              { borderColor: colors.foreground, backgroundColor: colors.primary },
            ]}
          >
            <Text style={[styles.primaryText, { color: colors.primaryForeground ?? "#fff" }]}>
              Rate Habiganize
            </Text>
          </Pressable>

          <Pressable testID="rate-prompt-later" onPress={dismiss} style={styles.laterBtn}>
            <Text style={[styles.laterText, { color: colors.mutedForeground }]}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 20, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 3,
    borderRadius: 24,
    padding: 22,
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 22,
    letterSpacing: -0.4,
    textTransform: "uppercase",
  },
  body: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  primaryBtn: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  laterBtn: {
    alignItems: "center",
    paddingVertical: 8,
  },
  laterText: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textDecorationLine: "underline",
  },
});
