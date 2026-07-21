import { Feather } from "@expo/vector-icons";
import {
  getGetDashboardQueryKey,
  getListHabitsQueryKey,
  useArchiveHabit,
  useCreateHabit,
  useDeleteHabit,
  useListHabits,
  useUnarchiveHabit,
  useUpdateHabit,
  type Habit,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrutalButton } from "@/components/BrutalButton";
import { BrutalCard } from "@/components/BrutalCard";
import { HabitFormModal } from "@/components/HabitFormModal";
import { MOOD_EMOJI } from "@/components/MoodSheet";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";
import { getReadableForeground, resolveHabitColor } from "@/lib/colors";
import {
  cancelHabitReminders,
  ensureNotificationPermission,
  scheduleHabitReminders,
} from "@/lib/reminders";

type Tab = "active" | "archived";

export default function HabitsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const queryClient = useQueryClient();
  usePrefetchOnFocus("habits");
  const [tab, setTab] = useState<Tab>("active");
  const { data: activeHabits, isLoading: loadingActive } = useListHabits({
    archived: false,
  });
  const { data: archivedHabits, isLoading: loadingArchived } = useListHabits({
    archived: true,
  });
  const habits = tab === "active" ? activeHabits : archivedHabits;
  const isLoading = tab === "active" ? loadingActive : loadingArchived;
  const archivedCount = archivedHabits?.length ?? 0;

  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit();
  const deleteMutation = useDeleteHabit();
  const archiveMutation = useArchiveHabit();
  const unarchiveMutation = useUnarchiveHabit();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey({ archived: false }) });
    queryClient.invalidateQueries({ queryKey: getListHabitsQueryKey({ archived: true }) });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  }, [queryClient]);

  const openCreate = () => {
    setEditing(null);
    setModalVisible(true);
  };

  const openEdit = (habit: Habit) => {
    setEditing(habit);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditing(null);
  };

  const handleSubmit = async (values: {
    name: string;
    description: string;
    color: string;
    icon: string;
    targetDays: string[];
    reminderEnabled: boolean;
    reminderTimes: string[];
  }) => {
    const wantsReminders = values.reminderEnabled && values.reminderTimes.length > 0;
    let permissionGranted = true;
    if (wantsReminders) {
      permissionGranted = await ensureNotificationPermission();
      if (!permissionGranted) {
        Alert.alert(
          "Notifications off",
          "The habit will be saved with reminders on, but they won't fire until you grant notification permission in Settings.",
        );
      }
    }
    const habitIdForCancel = editing?.id;
    const payload = {
      name: values.name,
      description: values.description || null,
      color: values.color,
      icon: values.icon,
      targetDays: values.targetDays,
      reminderEnabled: values.reminderEnabled,
      reminderTimes: values.reminderTimes,
    };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: async (habit) => {
            invalidate();
            closeModal();
            if (habitIdForCancel != null) await cancelHabitReminders(habitIdForCancel);
            if (permissionGranted && habit.reminderEnabled) {
              void scheduleHabitReminders(habit);
            }
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: (habit) => {
            invalidate();
            closeModal();
            if (permissionGranted && habit.reminderEnabled) {
              void scheduleHabitReminders(habit);
            }
          },
        }
      );
    }
  };

  const confirmDelete = (habit: Habit) => {
    const remove = () => {
      deleteMutation.mutate({ id: habit.id }, {
        onSuccess: () => {
          void cancelHabitReminders(habit.id);
          invalidate();
        },
      });
    };
    const message = `This permanently deletes "${habit.name}" and every completion in its history. This cannot be undone. To hide it but keep history, archive it instead.`;
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(message)) {
        remove();
      }
      return;
    }
    Alert.alert("Delete habit forever?", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete forever", style: "destructive", onPress: remove },
    ]);
  };

  const handleArchive = useCallback(
    (habit: Habit) => {
      archiveMutation.mutate(
        { id: habit.id },
        {
          onSuccess: () => {
            void cancelHabitReminders(habit.id);
            invalidate();
          },
        },
      );
    },
    [archiveMutation, invalidate],
  );

  const handleUnarchive = useCallback(
    (habit: Habit) => {
      unarchiveMutation.mutate(
        { id: habit.id },
        {
          onSuccess: (restored) => {
            invalidate();
            if (restored.reminderEnabled) {
              void scheduleHabitReminders(restored);
            }
          },
        },
      );
    },
    [unarchiveMutation, invalidate],
  );

  const onEdit = useCallback((h: Habit) => openEdit(h), []);
  const onDelete = useCallback((h: Habit) => confirmDelete(h), []);
  const onArchive = useCallback((h: Habit) => handleArchive(h), [handleArchive]);
  const onUnarchive = useCallback((h: Habit) => handleUnarchive(h), [handleUnarchive]);

  const renderItem = useCallback(
    ({ item, index }: { item: Habit; index: number }) => (
      <HabitListItem
        habit={item}
        index={index}
        colors={colors}
        archivedView={tab === "archived"}
        onEdit={onEdit}
        onDelete={onDelete}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
      />
    ),
    [colors, tab, onEdit, onDelete, onArchive, onUnarchive],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={habits ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: (isWeb ? 67 : insets.top) + 16,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        ItemSeparatorComponent={Separator}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={7}
        alwaysBounceVertical={false}
        overScrollMode="never"
        ListHeaderComponent={
          <View>
            <Text
              style={[
                styles.label,
                { color: colors.foreground, opacity: 0.65 },
              ]}
            >
              MANAGE
            </Text>
            <Text
              style={[styles.title, { color: colors.foreground }]}
              testID="text-habits-title"
            >
              Habits
            </Text>
            <View style={{ marginTop: 18, marginBottom: 14 }}>
              <BrutalButton
                label="+ Add habit"
                background={colors.accent}
                textColor={colors.foreground}
                onPress={openCreate}
                size="lg"
                containerStyle={{ alignSelf: "stretch" }}
                testID="button-add-habit"
              />
            </View>
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setTab("active")}
                testID="tab-active"
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === "active" }}
                style={[
                  styles.tabBtn,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: tab === "active" ? colors.foreground : colors.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: tab === "active" ? colors.card : colors.foreground },
                  ]}
                >
                  Active
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTab("archived")}
                testID="tab-archived"
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === "archived" }}
                style={[
                  styles.tabBtn,
                  {
                    borderColor: colors.foreground,
                    backgroundColor: tab === "archived" ? colors.foreground : colors.card,
                  },
                ]}
              >
                <Feather
                  name="archive"
                  size={14}
                  color={tab === "archived" ? colors.card : colors.foreground}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: tab === "archived" ? colors.card : colors.foreground },
                  ]}
                >
                  Archived
                </Text>
                {archivedCount > 0 ? (
                  <View
                    style={[
                      styles.tabBadge,
                      {
                        backgroundColor: tab === "archived" ? colors.accent : colors.foreground,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        { color: tab === "archived" ? colors.foreground : colors.card },
                      ]}
                    >
                      {archivedCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.foreground} />
            </View>
          ) : (
            <BrutalCard background={colors.card}>
              <View style={styles.emptyState}>
                <Feather
                  name={tab === "archived" ? "archive" : "inbox"}
                  size={36}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.emptyTitle, { color: colors.foreground }]}
                  testID={tab === "archived" ? "text-empty-archived" : "text-empty-habits"}
                >
                  {tab === "archived" ? "No archived habits" : "No habits yet"}
                </Text>
                <Text
                  style={[styles.emptyDesc, { color: colors.mutedForeground }]}
                >
                  {tab === "archived"
                    ? "Archived habits show up here. Their history is always preserved."
                    : 'Tap "Add habit" to start.'}
                </Text>
              </View>
            </BrutalCard>
          )
        }
      />

      <HabitFormModal
        visible={modalVisible}
        onClose={closeModal}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
        initialValues={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? null,
                color: editing.color ?? null,
                icon: editing.icon ?? null,
                targetDays: editing.targetDays ?? null,
                reminderEnabled: editing.reminderEnabled ?? false,
                reminderTimes: editing.reminderTimes ?? [],
              }
            : undefined
        }
        title={editing ? "Edit habit" : "New habit"}
      />
    </View>
  );
}

const keyExtractor = (h: Habit) => String(h.id);
const Separator = () => <View style={{ height: 14 }} />;

interface HabitListItemProps {
  habit: Habit;
  index: number;
  colors: ReturnType<typeof useColors>;
  archivedView: boolean;
  onEdit: (h: Habit) => void;
  onDelete: (h: Habit) => void;
  onArchive: (h: Habit) => void;
  onUnarchive: (h: Habit) => void;
}

const HabitListItem = memo(function HabitListItem({
  habit,
  index,
  colors,
  archivedView,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
}: HabitListItemProps) {
  const bg = resolveHabitColor(habit.color, index);
  const fg = getReadableForeground(bg);
  return (
    <BrutalCard background={bg} shadowOffset={6}>
      <View style={styles.habitRow}>
        <View style={styles.habitText}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text
              style={[styles.habitName, { color: fg, flexShrink: 1 }]}
              testID={`text-manage-habit-${habit.id}`}
              numberOfLines={1}
            >
              {habit.name}
            </Text>
            {habit.todayMood ? (
              <Text
                style={{ fontSize: 18, lineHeight: 22 }}
                testID={`manage-mood-${habit.id}`}
                accessibilityLabel={`Mood today: ${habit.todayMood}`}
              >
                {MOOD_EMOJI[habit.todayMood]}
              </Text>
            ) : null}
            {archivedView ? (
              <View
                style={{
                  backgroundColor: colors.foreground,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.card,
                    fontFamily: "Inter_900Black",
                    fontSize: 10,
                    letterSpacing: 1,
                  }}
                >
                  ARCHIVED
                </Text>
              </View>
            ) : null}
          </View>
          {habit.description ? (
            <Text
              style={[
                styles.habitDesc,
                { color: fg, opacity: 0.8 },
              ]}
              numberOfLines={2}
            >
              {habit.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.miniBadge, { backgroundColor: colors.foreground }]}>
              <Feather name="zap" size={11} color={colors.accent} />
              <Text style={[styles.miniBadgeText, { color: colors.accent }]}>
                {habit.currentStreak}
              </Text>
            </View>
            <View
              style={[
                styles.miniBadge,
                {
                  backgroundColor: colors.card,
                  borderWidth: 2,
                  borderColor: colors.foreground,
                },
              ]}
            >
              <Feather name="award" size={11} color={colors.foreground} />
              <Text style={[styles.miniBadgeText, { color: colors.foreground }]}>
                BEST {habit.longestStreak}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          {!archivedView ? (
            <>
              <Pressable
                onPress={() => onEdit(habit)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.card, borderColor: colors.foreground },
                ]}
                testID={`button-edit-habit-${habit.id}`}
                accessibilityLabel={`Edit ${habit.name}`}
              >
                <Feather name="edit-2" size={16} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => onArchive(habit)}
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.secondary ?? colors.card, borderColor: colors.foreground },
                ]}
                testID={`button-archive-habit-${habit.id}`}
                accessibilityLabel={`Archive ${habit.name}`}
              >
                <Feather name="archive" size={16} color={colors.foreground} />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => onUnarchive(habit)}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.foreground,
                },
              ]}
              testID={`button-unarchive-habit-${habit.id}`}
              accessibilityLabel={`Unarchive ${habit.name}`}
            >
              <Feather name="rotate-ccw" size={16} color={colors.foreground} />
            </Pressable>
          )}
          <Pressable
            onPress={() => onDelete(habit)}
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.destructive,
                borderColor: colors.foreground,
              },
            ]}
            testID={`button-delete-habit-${habit.id}`}
            accessibilityLabel={`Delete ${habit.name}`}
          >
            <Feather name="trash-2" size={16} color={colors.destructiveForeground} />
          </Pressable>
        </View>
      </View>
    </BrutalCard>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: "Inter_900Black",
    fontSize: 44,
    letterSpacing: -1.5,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 3,
  },
  tabText: {
    fontFamily: "Inter_900Black",
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontFamily: "Inter_900Black",
    fontSize: 11,
  },
  loadingContainer: { paddingVertical: 80, alignItems: "center" },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontFamily: "Inter_900Black", fontSize: 20, marginTop: 4 },
  emptyDesc: { fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center" },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  habitText: { flex: 1, gap: 4 },
  habitName: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 18,
    letterSpacing: -0.3,
  },
  habitDesc: { fontFamily: "Inter_500Medium", fontSize: 13 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  miniBadgeText: { fontFamily: "Inter_900Black", fontSize: 11 },
  actions: { gap: 8 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
