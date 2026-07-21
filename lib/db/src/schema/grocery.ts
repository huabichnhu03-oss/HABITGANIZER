import { pgTable, text, serial, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

/** Shopping list items — one narrow row per line item; scoped by wallet (Clerk user id). */
export const groceryItemsTable = pgTable(
  "grocery_items",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").notNull(),
    name: text("name").notNull(),
    checked: boolean("checked").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    byWallet: index("grocery_items_wallet_idx").on(t.walletId),
    byWalletSort: index("grocery_items_wallet_sort_idx").on(t.walletId, t.sortOrder),
  }),
);

export type GroceryItemRow = typeof groceryItemsTable.$inferSelect;
