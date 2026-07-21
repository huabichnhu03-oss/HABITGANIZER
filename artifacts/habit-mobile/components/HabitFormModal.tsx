import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { HABIT_SWATCHES, getReadableForeground, isValidHex, normalizeHex, resolveHabitColor } from "@/lib/colors";
import { DEFAULT_HABIT_ICON, HABIT_ICONS, resolveHabitIcon } from "@/lib/icons";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

interface HabitFormValues {
  name: string;
  description: string;
  color: string;
  icon: string;
  targetDays: string[];
  reminderEnabled: boolean;
  reminderTimes: string[];
}

interface HabitFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (values: HabitFormValues) => void;
  isPending?: boolean;
  initialValues?: {
    name: string;
    description: string | null;
    color?: string | null;
    icon?: string | null;
    targetDays?: string[] | null;
    reminderEnabled?: boolean | null;
    reminderTimes?: string[] | null;
  };
  title: string;
}

const DAYS: { value: string; label: string }[] = [
  { value: "all", label: "Everyday" },
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

export function HabitFormModal({
  visible,
  onClose,
  onSubmit,
  isPending,
  initialValues,
  title,
}: HabitFormModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string>(HABIT_SWATCHES[0].hex);
  const [hexDraft, setHexDraft] = useState<string>("");
  const [showHexInput, setShowHexInput] = useState(false);
  const [icon, setIcon] = useState<string>(DEFAULT_HABIT_ICON);
  const [targetDays, setTargetDays] = useState<string[]>(["all"]);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState<string[]>([]);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialValues?.name ?? "");
      setDescription(initialValues?.description ?? "");
      const initialColor = resolveHabitColor(initialValues?.color ?? null, 0);
      setColor(initialColor);
      const isCustomInitial =
        !!initialColor &&
        !HABIT_SWATCHES.some(
          (s) => s.hex.toLowerCase() === initialColor.toLowerCase(),
        );
      setHexDraft(isCustomInitial ? initialColor : "");
      setShowHexInput(isCustomInitial);
      setIcon(resolveHabitIcon(initialValues?.icon));
      const days = initialValues?.targetDays;
      setTargetDays(days && days.length > 0 ? days : ["all"]);
      setReminderEnabled(!!initialValues?.reminderEnabled);
      const times = initialValues?.reminderTimes ?? [];
      setReminderTimes(times.filter((t) => TIME_RE.test(t)));
      setPickerIndex(null);
      setTouched(false);
    }
  }, [visible, initialValues]);

  const addReminderTime = () => {
    setReminderTimes((prev) => [...prev, "08:00"]);
  };
  const removeReminderTime = (idx: number) => {
    setReminderTimes((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setReminderEnabled(false);
      return next;
    });
  };
  const setReminderTimeAt = (idx: number, value: string) => {
    setReminderTimes((prev) => prev.map((t, i) => (i === idx ? value : t)));
  };
  const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== "ios") {
      setPickerIndex(null);
    }
    if (event.type === "dismissed" || !date || pickerIndex === null) return;
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    setReminderTimeAt(pickerIndex, `${hh}:${mm}`);
  };
  const pickerDate = (() => {
    if (pickerIndex === null) return new Date();
    const t = reminderTimes[pickerIndex];
    const m = t ? TIME_RE.exec(t) : null;
    const d = new Date();
    if (m) {
      d.setHours(parseInt(t.split(":")[0], 10), parseInt(t.split(":")[1], 10), 0, 0);
    }
    return d;
  })();

  const nameError =
    touched && name.trim().length === 0 ? "Name is required" : null;
  const daysError =
    touched && targetDays.length === 0 ? "Pick at least one day" : null;

  const toggleDay = (value: string) => {
    if (value === "all") {
      setTargetDays(["all"]);
      return;
    }
    let next = targetDays.filter((d) => d !== "all");
    if (next.includes(value)) {
      next = next.filter((d) => d !== value);
    } else {
      next.push(value);
    }
    if (next.length === 7) next = ["all"];
    setTargetDays(next);
  };

  const handleSubmit = () => {
    setTouched(true);
    if (name.trim().length === 0) return;
    if (targetDays.length === 0) return;
    if (showHexInput && hexDraft.length > 0 && !isValidHex(hexDraft)) return;
    if (showHexInput && hexDraft.length === 0) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      color: normalizeHex(color) ?? color,
      icon,
      targetDays,
      reminderEnabled,
      reminderTimes: reminderEnabled ? reminderTimes.filter((t) => TIME_RE.test(t)) : [],
    });
  };

  const isDayActive = (value: string) => {
    if (value === "all") return targetDays.includes("all");
    return targetDays.includes("all") || targetDays.includes(value);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingTop: insets.top + 60 }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.foreground,
            },
          ]}
        >
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text
                style={{
                  fontFamily: "Inter_900Black",
                  fontSize: 26,
                  color: colors.foreground,
                  textTransform: "uppercase",
                  letterSpacing: -0.5,
                  flex: 1,
                }}
                testID="text-form-title"
              >
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.foreground,
                  },
                ]}
                testID="button-close-form"
              >
                <Feather name="x" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                NAME
              </Text>
              <BrutalCard background={colors.card} shadowOffset={4}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Morning Run"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                  testID="input-habit-name"
                />
              </BrutalCard>
              {nameError ? (
                <Text
                  style={[styles.errorText, { color: colors.destructive }]}
                  testID="text-form-error"
                >
                  {nameError}
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                DESCRIPTION
              </Text>
              <BrutalCard background={colors.card} shadowOffset={4}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      minHeight: 80,
                      textAlignVertical: "top",
                    },
                  ]}
                  testID="input-habit-description"
                />
              </BrutalCard>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                COLOR
              </Text>
              <View style={styles.swatchRow} testID="color-swatches">
                {HABIT_SWATCHES.map((s) => {
                  const selected =
                    !showHexInput &&
                    s.hex.toLowerCase() === color.toLowerCase();
                  return (
                    <Pressable
                      key={s.hex}
                      onPress={() => {
                        setColor(s.hex);
                        setShowHexInput(false);
                      }}
                      accessibilityLabel={s.name}
                      testID={`swatch-${s.name.toLowerCase()}`}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: s.hex,
                          borderColor: colors.foreground,
                          borderWidth: selected ? 4 : 2,
                          transform: [{ scale: selected ? 1.08 : 1 }],
                        },
                      ]}
                    />
                  );
                })}
                {(() => {
                  const isCustomActive =
                    showHexInput ||
                    (isValidHex(color) &&
                      !HABIT_SWATCHES.some(
                        (s) => s.hex.toLowerCase() === color.toLowerCase(),
                      ));
                  const previewBg =
                    isCustomActive && isValidHex(color) ? color : colors.card;
                  return (
                    <Pressable
                      onPress={() => {
                        setShowHexInput(true);
                        if (!hexDraft) setHexDraft(color || "#");
                      }}
                      accessibilityLabel="Other color"
                      testID="swatch-other"
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: previewBg,
                          borderColor: colors.foreground,
                          borderWidth: isCustomActive ? 4 : 2,
                          transform: [{ scale: isCustomActive ? 1.08 : 1 }],
                          alignItems: "center",
                          justifyContent: "center",
                        },
                      ]}
                    >
                      <Feather
                        name="plus"
                        size={20}
                        color={
                          isCustomActive && isValidHex(color)
                            ? getReadableForeground(color)
                            : colors.foreground
                        }
                      />
                    </Pressable>
                  );
                })()}
              </View>
              {showHexInput ? (
                <View
                  style={{ marginTop: 10, gap: 8 }}
                  testID="custom-color-row"
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <View
                      style={[
                        styles.hexPreview,
                        {
                          backgroundColor: isValidHex(hexDraft)
                            ? (normalizeHex(hexDraft) ?? hexDraft)
                            : colors.card,
                          borderColor: colors.foreground,
                        },
                      ]}
                    />
                    <BrutalCard
                      background={colors.card}
                      shadowOffset={3}
                      containerStyle={{ flex: 1 }}
                    >
                      <TextInput
                        value={hexDraft}
                        onChangeText={(v) => {
                          setHexDraft(v);
                          const n = normalizeHex(v);
                          if (n) setColor(n);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholder="#aabbcc"
                        placeholderTextColor={colors.mutedForeground}
                        maxLength={7}
                        style={[
                          styles.input,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                        testID="input-color-hex"
                      />
                      {touched && (hexDraft.length === 0 || !isValidHex(hexDraft)) ? (
                        <Text
                          style={{
                            color: colors.destructive ?? "#d11",
                            fontFamily: "Inter_700Bold",
                            fontSize: 12,
                            marginTop: 6,
                          }}
                          testID="error-color-hex"
                        >
                          {hexDraft.length === 0
                            ? "Enter a custom hex or pick a swatch"
                            : "Enter a hex like #ff8800"}
                        </Text>
                      ) : null}
                    </BrutalCard>
                  </View>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                    }}
                  >
                    Type a hex color like #ff8800.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                ICON
              </Text>
              <View style={styles.iconGrid} testID="icon-grid">
                {HABIT_ICONS.map((iconName) => {
                  const selected = iconName === icon;
                  return (
                    <Pressable
                      key={iconName}
                      onPress={() => setIcon(iconName)}
                      accessibilityLabel={iconName}
                      testID={`icon-${iconName}`}
                      style={[
                        styles.iconTile,
                        {
                          backgroundColor: selected
                            ? colors.foreground
                            : colors.card,
                          borderColor: colors.foreground,
                          borderWidth: selected ? 3 : 2,
                          transform: [{ scale: selected ? 1.06 : 1 }],
                        },
                      ]}
                    >
                      <Feather
                        name={iconName as React.ComponentProps<typeof Feather>["name"]}
                        size={22}
                        color={selected ? colors.accent : colors.foreground}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                FREQUENCY
              </Text>
              <View style={styles.dayRow} testID="day-pills">
                {DAYS.map((day) => {
                  const active = isDayActive(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      onPress={() => toggleDay(day.value)}
                      testID={`day-${day.value}`}
                      style={[
                        styles.dayPill,
                        {
                          backgroundColor: active
                            ? colors.foreground
                            : colors.card,
                          borderColor: colors.foreground,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: "Inter_900Black",
                          fontSize: 12,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          color: active ? colors.accent : colors.foreground,
                        }}
                      >
                        {day.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {daysError ? (
                <Text
                  style={[styles.errorText, { color: colors.destructive }]}
                  testID="text-days-error"
                >
                  {daysError}
                </Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <View style={styles.reminderHeader}>
                <Text style={[styles.label, { color: colors.foreground }]}>REMINDERS</Text>
                <Switch
                  value={reminderEnabled}
                  onValueChange={(next) => {
                    setReminderEnabled(next);
                    if (next && reminderTimes.length === 0) {
                      setReminderTimes(["08:00"]);
                    }
                  }}
                  trackColor={{ false: colors.muted, true: colors.foreground }}
                  thumbColor={reminderEnabled ? colors.accent : colors.card}
                  testID="toggle-reminder-enabled"
                />
              </View>
              {reminderEnabled ? (
                <View style={{ gap: 10 }} testID="reminder-times">
                  {reminderTimes.length === 0 ? (
                    <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      No reminder times yet. Add one below.
                    </Text>
                  ) : (
                    reminderTimes.map((t, idx) => (
                      <View key={idx} style={styles.reminderRow} testID={`reminder-time-row-${idx}`}>
                        <Pressable
                          onPress={() => setPickerIndex(idx)}
                          style={[
                            styles.timePill,
                            { backgroundColor: colors.card, borderColor: colors.foreground },
                          ]}
                          testID={`reminder-time-button-${idx}`}
                        >
                          <Feather name="clock" size={16} color={colors.foreground} />
                          <Text
                            style={{
                              fontFamily: "Inter_900Black",
                              fontSize: 18,
                              color: colors.foreground,
                              letterSpacing: 0.5,
                            }}
                          >
                            {t}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => removeReminderTime(idx)}
                          accessibilityLabel={`Remove reminder ${t}`}
                          testID={`reminder-time-remove-${idx}`}
                          style={[
                            styles.removeBtn,
                            { backgroundColor: colors.card, borderColor: colors.foreground },
                          ]}
                        >
                          <Feather name="x" size={18} color={colors.foreground} />
                        </Pressable>
                      </View>
                    ))
                  )}
                  <BrutalButton
                    label="+ Add time"
                    background={colors.foreground}
                    textColor={colors.accent}
                    onPress={addReminderTime}
                    size="md"
                    containerStyle={{ alignSelf: "flex-start" }}
                    testID="reminder-time-add"
                  />
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                    Reminders fire on this habit's scheduled days, in your device's local time.
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  Off. Turn on to get nudged at chosen times on scheduled days.
                </Text>
              )}
              {pickerIndex !== null ? (
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  is24Hour
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handlePickerChange}
                />
              ) : null}
            </View>

            <View style={styles.actions}>
              <BrutalButton
                label="Cancel"
                background={colors.card}
                textColor={colors.foreground}
                onPress={onClose}
                size="lg"
                containerStyle={{ flex: 1 }}
                testID="button-cancel-form"
              />
              <BrutalButton
                label={isPending ? "SAVING..." : "Save"}
                background={colors.accent}
                textColor={colors.foreground}
                onPress={handleSubmit}
                disabled={isPending}
                size="lg"
                containerStyle={{ flex: 1 }}
                testID="button-save-form"
              />
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 20, 20, 0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  hexPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 3,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  reminderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
