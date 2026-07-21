import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createGroceryItem,
  extractApiErrorMessage,
  getListGroceryItemsQueryKey,
  useListGroceryItems,
  useCreateGroceryItem,
  useUpdateGroceryItem,
  useDeleteGroceryItem,
  useClearCheckedGroceryItems,
  type GroceryItem,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BrutalCard } from "@/components/BrutalCard";
import { useColors } from "@/hooks/useColors";

const LEGACY_STORAGE_PREFIX = "habiganize:grocery_v1";

async function readLegacyLocalGrocery(userId: string): Promise<Array<{ name: string; checked: boolean }> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: Array<{ name: string; checked: boolean }> = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { name?: string }).name === "string" &&
        typeof (item as { checked?: boolean }).checked === "boolean"
      ) {
        const name = (item as { name: string }).name.trim();
        if (name) out.push({ name, checked: (item as { checked: boolean }).checked });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

async function clearLegacyLocalGrocery(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${LEGACY_STORAGE_PREFIX}:${userId}`);
  } catch {
    /* ignore */
  }
}

function sortForDisplay(items: GroceryItem[]): GroceryItem[] {
  const u = items
    .filter((i) => !i.checked)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const c = items
    .filter((i) => i.checked)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  return [...u, ...c];
}

export function GroceryList() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const userId = user?.id;
  const [draft, setDraft] = useState("");
  const [expanded, setExpanded] = useState(true);
  const migrationDoneRef = useRef(false);

  const groceryKey = useMemo(() => getListGroceryItemsQueryKey(), []);

  const { data: items = [], isLoading, isError, error, refetch } = useListGroceryItems({
    query: { enabled: !!userId } as never,
  });
  const syncErrorDetail = isError ? extractApiErrorMessage(error, "") : "";

  const createMutation = useCreateGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const updateMutation = useUpdateGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const deleteMutation = useDeleteGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const clearCheckedMutation = useClearCheckedGroceryItems({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  useEffect(() => {
    if (!userId || migrationDoneRef.current || isLoading || items.length > 0) return;
    void (async () => {
      const legacy = await readLegacyLocalGrocery(userId);
      if (!legacy) {
        migrationDoneRef.current = true;
        return;
      }
      migrationDoneRef.current = true;
      let allOk = true;
      for (const row of legacy) {
        try {
          await createGroceryItem({ name: row.name, checked: row.checked });
        } catch {
          allOk = false;
          break;
        }
      }
      if (allOk) await clearLegacyLocalGrocery(userId);
      queryClient.invalidateQueries({ queryKey: groceryKey });
    })();
  }, [userId, isLoading, items.length, groceryKey, queryClient]);

  const ordered = useMemo(() => sortForDisplay(items), [items]);

  const addItem = useCallback(() => {
    const name = draft.trim();
    if (!name) return;
    createMutation.mutate({ data: { name } });
    setDraft("");
  }, [draft, createMutation]);

  const toggleItem = useCallback(
    (row: GroceryItem) => {
      updateMutation.mutate({ id: row.id, data: { checked: !row.checked } });
    },
    [updateMutation],
  );

  const removeItem = useCallback(
    (id: number) => {
      deleteMutation.mutate({ id });
    },
    [deleteMutation],
  );

  const onClearChecked = useCallback(() => {
    clearCheckedMutation.mutate();
  }, [clearCheckedMutation]);

  if (!userId) return null;

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    clearCheckedMutation.isPending;

  return (
    <BrutalCard background={colors.card} containerStyle={{ marginTop: 4 }} shadowOffset={5}>
      <View style={styles.wrap} testID="grocery-list">
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          style={styles.header}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={styles.headerLeft}>
            <Feather name="shopping-cart" size={16} color={colors.foreground} />
            <Text style={[styles.title, { color: colors.foreground }]}>Grocery list</Text>
            {items.length > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.foreground }]}>
                <Text style={[styles.badgeText, { color: colors.foreground }]}>{unchecked.length} left</Text>
              </View>
            )}
          </View>
          <Text style={[styles.chevron, { color: colors.mutedForeground }]}>{expanded ? "−" : "+"}</Text>
        </Pressable>

        {expanded && (
          <View style={styles.body}>
            {isError && (
              <View style={styles.syncErrorWrap}>
                <Text style={[styles.hint, { color: colors.destructive ?? "#ef4444" }]}>
                  Couldn&apos;t sync.{" "}
                  <Text style={{ textDecorationLine: "underline" }} onPress={() => refetch()}>
                    Retry
                  </Text>
                </Text>
                {syncErrorDetail ? (
                  <Text
                    style={[styles.syncErrorDetail, { color: colors.destructive ?? "#ef4444" }]}
                    numberOfLines={3}
                  >
                    {syncErrorDetail}
                  </Text>
                ) : null}
              </View>
            )}
            <View style={styles.addRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={addItem}
                placeholder="Add milk, eggs, bread…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={80}
                editable={!busy}
                testID="grocery-input"
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.foreground,
                    backgroundColor: colors.muted,
                  },
                ]}
              />
              <Pressable
                onPress={addItem}
                disabled={!draft.trim() || busy}
                testID="grocery-add"
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.foreground,
                    opacity: draft.trim() && !busy ? 1 : 0.4,
                  },
                ]}
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
              </Pressable>
            </View>

            {isLoading ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>Loading…</Text>
            ) : ordered.length === 0 ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Stick to your list — add items before you shop.
              </Text>
            ) : (
              ordered.map((item) => (
                <View
                  key={item.id}
                  style={styles.itemRow}
                  testID={`grocery-item-${item.id}`}
                >
                  <Pressable
                    onPress={() => toggleItem(item)}
                    disabled={busy}
                    style={[
                      styles.check,
                      {
                        borderColor: colors.foreground,
                        backgroundColor: item.checked ? colors.foreground : colors.card,
                      },
                    ]}
                  >
                    {item.checked ? (
                      <Feather name="check" size={14} color={colors.accent} />
                    ) : null}
                  </Pressable>
                  <Text
                    style={[
                      styles.itemName,
                      {
                        color: colors.foreground,
                        textDecorationLine: item.checked ? "line-through" : "none",
                        opacity: item.checked ? 0.55 : 1,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Pressable
                    onPress={() => removeItem(item.id)}
                    disabled={busy}
                    hitSlop={8}
                    accessibilityLabel="Remove"
                  >
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))
            )}

            {checked.length > 0 && !isLoading && (
              <Pressable
                onPress={onClearChecked}
                disabled={busy}
                testID="grocery-clear-checked"
                style={styles.clearBtn}
              >
                <Feather name="trash-2" size={12} color={colors.mutedForeground} />
                <Text style={[styles.clearText, { color: colors.mutedForeground }]}>
                  Clear checked ({checked.length})
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </BrutalCard>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { fontFamily: "Inter_900Black", fontSize: 13, letterSpacing: 0.3, textTransform: "uppercase" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 2 },
  badgeText: { fontFamily: "Inter_800ExtraBold", fontSize: 10 },
  chevron: { fontFamily: "Inter_800ExtraBold", fontSize: 14 },
  body: { padding: 12, gap: 8 },
  addRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 8,
  },
  syncErrorWrap: { gap: 4 },
  syncErrorDetail: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textAlign: "center",
  },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  itemName: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 14 },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 4,
  },
  clearText: { fontFamily: "Inter_700Bold", fontSize: 11 },
});
