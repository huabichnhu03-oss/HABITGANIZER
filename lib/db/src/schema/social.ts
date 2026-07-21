import { pgTable, text, serial, timestamp, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";
import { walletsTable } from "./rewards";

/** Public profile + stable friend code for invites (wallet_id === Clerk user id). */
export const userSocialProfilesTable = pgTable(
  "user_social_profiles",
  {
    walletId: text("wallet_id")
      .primaryKey()
      .references(() => walletsTable.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull().default(""),
    friendCode: text("friend_code").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export type UserSocialProfile = typeof userSocialProfilesTable.$inferSelect;

/** Rows are pending-only; accepted → friendship row + delete request; declined → delete request. */
export const friendRequestsTable = pgTable(
  "friend_requests",
  {
    id: serial("id").primaryKey(),
    fromWalletId: text("from_wallet_id")
      .references(() => walletsTable.id, { onDelete: "cascade" })
      .notNull(),
    toWalletId: text("to_wallet_id")
      .references(() => walletsTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pairDirUidx: uniqueIndex("friend_requests_from_to_uidx").on(t.fromWalletId, t.toWalletId),
    toIdx: index("friend_requests_to_idx").on(t.toWalletId),
    fromIdx: index("friend_requests_from_idx").on(t.fromWalletId),
  }),
);

export type FriendRequest = typeof friendRequestsTable.$inferSelect;

/** Undirected edge: always store userA < userB lexicographically. */
export const friendshipsTable = pgTable(
  "friendships",
  {
    userA: text("user_a")
      .references(() => walletsTable.id, { onDelete: "cascade" })
      .notNull(),
    userB: text("user_b")
      .references(() => walletsTable.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userA, t.userB] }),
    userAIdx: index("friendships_user_a_idx").on(t.userA),
    userBIdx: index("friendships_user_b_idx").on(t.userB),
  }),
);

export type Friendship = typeof friendshipsTable.$inferSelect;
