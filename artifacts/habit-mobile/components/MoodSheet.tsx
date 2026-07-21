import { Feather } from "@expo/vector-icons";
import { type Habit, type HabitMood } from "@workspace/api-client-react";
import React, { useEffect, useRef, useState } from "react";
import {
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

import { BrutalButton } from "@/components/BrutalButton";
import { useColors } from "@/hooks/useColors";

const NOTE_MAX = 280;

export const MOOD_OPTIONS: ReadonlyArray<{
  value: HabitMood;
  emoji: string;
  label: string;
}> = [
  { value: "great", emoji: "😀", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "meh", emoji: "😕", label: "Meh" },
  { value: "bad", emoji: "😞", label: "Bad" },
];

export const MOOD_EMOJI: Record<HabitMood, string> = {
  great: "😀",
  good: "🙂",
  okay: "😐",
  meh: "😕",
  bad: "😞",
};

interface MoodSheetProps {
  open: boolean;
  habit: Habit | null;
  onClose: () => void;
  onSave: (mood: HabitMood | null, note: string | null) => void;
  onRemove: () => void;
}

export function MoodSheet({ open, habit, onClose, onSave, onRemove }: MoodSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const visible = open;
  const [mood, setMood] = useState<HabitMood | null>(null);
  const [note, setNote] = useState("");
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (open && habit && habit.id !== lastIdRef.current) {
      setMood(habit.todayMood ?? null);
      setNote(habit.todayNote ?? "");
      lastIdRef.current = habit.id;
    }
    if (!open) lastIdRef.current = null;
  }, [open, habit]);

  const charsLeft = NOTE_MAX - note.length;

  const handleSave = () => {
    const trimmed = note.trim();
    onSave(mood, trimmed.length > 0 ? trimmed.slice(0, NOTE_MAX) : null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.foreground,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          testID="mood-sheet"
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {habit?.name ?? "Habit"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.foreground, opacity: 0.6 }]}>
            How did it feel? Add a quick note if you want.
          </Text>

          <Text style={[styles.label, { color: colors.foreground }]}>MOOD</Text>
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((opt) => {
              const selected = mood === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setMood(selected ? null : opt.value)}
                  testID={`mood-option-${opt.value}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.label}
                  style={[
                    styles.moodBtn,
                    {
                      backgroundColor: selected ? colors.accent : colors.muted,
                      borderColor: colors.foreground,
                      transform: [{ translateY: selected ? -2 : 0 }],
                    },
                  ]}
                >
                  <Text style={styles.moodEmoji}>{opt.emoji}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.noteHeader}>
            <Text style={[styles.label, { color: colors.foreground }]}>NOTE</Text>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 12,
                color: charsLeft < 20 ? colors.destructive : colors.foreground,
                opacity: charsLeft < 20 ? 1 : 0.55,
              }}
            >
              {charsLeft}
            </Text>
          </View>
          <TextInput
            value={note}
            onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
            placeholder="Optional — felt energized, harder than usual…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={NOTE_MAX}
            testID="mood-note-input"
            style={[
              styles.noteInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.foreground,
                color: colors.foreground,
              },
            ]}
          />

          <View style={styles.actions}>
            <Pressable
              onPress={onRemove}
              testID="mood-remove"
              style={styles.removeBtn}
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
              <Text style={[styles.removeText, { color: colors.destructive }]}>
                REMOVE
              </Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <BrutalButton
              label="Skip"
              onPress={onClose}
              background={colors.card}
              textColor={colors.foreground}
              size="sm"
              testID="mood-skip"
            />
            <BrutalButton
              label="Save"
              onPress={handleSave}
              background={colors.primary}
              textColor={colors.primaryForeground}
              size="sm"
              testID="mood-save"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 99,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 24,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 2,
    marginBottom: 18,
  },
  label: {
    fontFamily: "Inter_900Black",
    fontSize: 12,
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  moodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  moodBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  moodEmoji: { fontSize: 28, lineHeight: 32 },
  noteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  noteInput: {
    minHeight: 84,
    borderWidth: 3,
    borderRadius: 18,
    padding: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlignVertical: "top",
    marginBottom: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  removeText: { fontFamily: "Inter_900Black", fontSize: 12, letterSpacing: 1 },
});
