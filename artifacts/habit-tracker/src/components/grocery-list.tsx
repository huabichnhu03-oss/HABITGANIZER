import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListGroceryItemsQueryKey,
  useListGroceryItems,
  useCreateGroceryItem,
  useUpdateGroceryItem,
  useDeleteGroceryItem,
  useClearCheckedGroceryItems,
  createGroceryItem,
  extractApiErrorMessage,
  type GroceryItem,
} from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { Check, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LEGACY_STORAGE_PREFIX = "habiganize:grocery_v1";

function readLegacyLocalGrocery(userId: string): Array<{ name: string; checked: boolean }> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${userId}`);
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

function clearLegacyLocalGrocery(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}:${userId}`);
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

  const createItem = useCreateGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const updateItem = useUpdateGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const deleteItem = useDeleteGroceryItem({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  const clearChecked = useClearCheckedGroceryItems({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: groceryKey });
      },
    },
  });

  /** One-time: move desktop localStorage list into the API, then drop the legacy key. */
  useEffect(() => {
    if (!userId || migrationDoneRef.current || isLoading || items.length > 0) return;
    const legacy = readLegacyLocalGrocery(userId);
    if (!legacy) {
      migrationDoneRef.current = true;
      return;
    }
    migrationDoneRef.current = true;
    void (async () => {
      let allOk = true;
      for (const row of legacy) {
        try {
          await createGroceryItem({ name: row.name, checked: row.checked });
        } catch {
          allOk = false;
          break;
        }
      }
      if (allOk) clearLegacyLocalGrocery(userId);
      queryClient.invalidateQueries({ queryKey: groceryKey });
    })();
  }, [userId, isLoading, items.length, groceryKey, queryClient]);

  const ordered = useMemo(() => sortForDisplay(items), [items]);

  const addItem = useCallback(() => {
    const name = draft.trim();
    if (!name) return;
    createItem.mutate({ data: { name } });
    setDraft("");
  }, [draft, createItem]);

  const toggleItem = useCallback(
    (row: GroceryItem) => {
      updateItem.mutate({ id: row.id, data: { checked: !row.checked } });
    },
    [updateItem],
  );

  const removeItem = useCallback(
    (id: number) => {
      deleteItem.mutate({ id });
    },
    [deleteItem],
  );

  const onClearChecked = useCallback(() => {
    clearChecked.mutate();
  }, [clearChecked]);

  if (!userId) return null;

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);
  const busy =
    createItem.isPending || updateItem.isPending || deleteItem.isPending || clearChecked.isPending;

  return (
    <section
      className="bg-white border-brutal shadow-brutal rounded-2xl overflow-hidden"
      data-testid="grocery-list"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 border-b-2 border-foreground/10 hover:bg-muted/30 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="w-4 h-4 shrink-0" strokeWidth={2.5} />
          <span className="text-sm font-black uppercase tracking-tight">Grocery list</span>
          {items.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent border-brutal-sm">
              {unchecked.length} left
            </span>
          )}
        </div>
        <span className="text-xs font-bold text-muted-foreground">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {isError && (
            <div className="text-xs font-bold text-destructive text-center space-y-1">
              <p>
                Couldn’t sync list.{" "}
                <button type="button" onClick={() => refetch()} className="underline">
                  Retry
                </button>
              </p>
              {syncErrorDetail ? (
                <p className="font-medium text-[11px] text-destructive/90 break-words" title={syncErrorDetail}>
                  {syncErrorDetail}
                </p>
              ) : null}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addItem();
              }}
              placeholder="Add milk, eggs, bread…"
              maxLength={80}
              disabled={busy}
              data-testid="grocery-input"
              className="flex-1 min-w-0 px-3 py-2 text-sm font-bold border-brutal-sm rounded-xl bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!draft.trim() || busy}
              data-testid="grocery-add"
              className="shrink-0 px-3 py-2 border-brutal-sm rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Add item"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
            </button>
          </div>

          {isLoading ? (
            <p className="text-xs font-bold text-muted-foreground text-center py-3">Loading…</p>
          ) : ordered.length === 0 ? (
            <p className="text-xs font-bold text-muted-foreground text-center py-3">
              Stick to your list — add items before you shop.
            </p>
          ) : (
            <ul className="space-y-1">
              {ordered.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg group",
                    item.checked ? "opacity-60" : "hover:bg-muted/40",
                  )}
                  data-testid={`grocery-item-${item.id}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleItem(item)}
                    disabled={busy}
                    className={cn(
                      "shrink-0 w-6 h-6 rounded-md border-brutal-sm flex items-center justify-center transition-colors",
                      item.checked ? "bg-primary text-white" : "bg-white hover:bg-accent/50",
                    )}
                    aria-label={item.checked ? "Uncheck" : "Check off"}
                  >
                    {item.checked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 text-sm font-bold truncate",
                      item.checked && "line-through text-muted-foreground",
                    )}
                  >
                    {item.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={busy}
                    className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive transition-opacity disabled:opacity-30"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {checked.length > 0 && !isLoading && (
            <button
              type="button"
              onClick={onClearChecked}
              disabled={busy}
              data-testid="grocery-clear-checked"
              className="flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground mx-auto pt-1 disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
              Clear checked ({checked.length})
            </button>
          )}
        </div>
      )}
    </section>
  );
}
