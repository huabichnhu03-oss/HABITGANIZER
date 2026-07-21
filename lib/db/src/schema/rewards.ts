import { pgTable, text, integer, serial, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const walletsTable = pgTable("wallets", {
  id: text("id").primaryKey(),
  coins: integer("coins").notNull().default(0),
  food: integer("food").notNull().default(0),
  water: integer("water").notNull().default(0),
  currentVisitorSlug: text("current_visitor_slug"),
  visitorAvailableAt: timestamp("visitor_available_at", { withTimezone: true }).defaultNow().notNull(),
  /** Rate-limits bonus coins from rewarded video / sponsor placements. */
  lastWatchAdCoinsAt: timestamp("last_watch_ad_coins_at", { withTimezone: true }),
  /** Rate-limits playdate cooldown skip from ads. */
  lastWatchAdVisitorSpeedupAt: timestamp("last_watch_ad_visitor_speedup_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Wallet = typeof walletsTable.$inferSelect;

export const petsTable = pgTable("pets", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  breed: text("breed").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  imagePath: text("image_path").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type Pet = typeof petsTable.$inferSelect;

export type PetAccessoryPlacement = {
  accessoryId: string;
  x: number;
  y: number;
};

export const userPetsTable = pgTable(
  "user_pets",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
    petSlug: text("pet_slug").references(() => petsTable.slug, { onDelete: "cascade" }).notNull(),
    nickname: text("nickname"),
    accessory: text("accessory"),
    accessoryLayout: jsonb("accessory_layout").$type<PetAccessoryPlacement[]>().notNull().default([]),
    hunger: integer("hunger").notNull().default(100),
    thirst: integer("thirst").notNull().default(100),
    level: integer("level").notNull().default(1),
    tricksLearned: integer("tricks_learned").notNull().default(0),
    lastTrainAt: timestamp("last_train_at", { withTimezone: true }).defaultNow().notNull(),
    lastDecayAt: timestamp("last_decay_at", { withTimezone: true }).defaultNow().notNull(),
    hungerZeroSince: timestamp("hunger_zero_since", { withTimezone: true }),
    thirstZeroSince: timestamp("thirst_zero_since", { withTimezone: true }),
    wellFedSince: timestamp("well_fed_since", { withTimezone: true }),
    lastWalkAt: timestamp("last_walk_at", { withTimezone: true }).defaultNow().notNull(),
    lastBathAt: timestamp("last_bath_at", { withTimezone: true }).defaultNow().notNull(),
    lastPlayAt: timestamp("last_play_at", { withTimezone: true }).defaultNow().notNull(),
    acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqWalletPet: unique("uniq_wallet_pet").on(t.walletId, t.petSlug),
  })
);

export const insertUserPetSchema = createInsertSchema(userPetsTable).omit({ id: true, acquiredAt: true });
export type InsertUserPet = z.infer<typeof insertUserPetSchema>;
export type UserPet = typeof userPetsTable.$inferSelect;

export const petFoodsTable = pgTable("pet_foods", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  hungerAmount: integer("hunger_amount").notNull(),
  bonusLevel: integer("bonus_level").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type PetFood = typeof petFoodsTable.$inferSelect;

export const userFoodInventoryTable = pgTable(
  "user_food_inventory",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
    foodSlug: text("food_slug").references(() => petFoodsTable.slug, { onDelete: "cascade" }).notNull(),
    quantity: integer("quantity").notNull().default(0),
  },
  (t) => ({
    uniqWalletFood: unique("uniq_wallet_food").on(t.walletId, t.foodSlug),
  })
);
export type UserFoodInventory = typeof userFoodInventoryTable.$inferSelect;

export const petToysTable = pgTable("pet_toys", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  happinessGain: integer("happiness_gain").notNull(),
  cooldownMinutes: integer("cooldown_minutes").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type PetToy = typeof petToysTable.$inferSelect;

export const userToysTable = pgTable(
  "user_toys",
  {
    id: serial("id").primaryKey(),
    walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
    toySlug: text("toy_slug").references(() => petToysTable.slug, { onDelete: "cascade" }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqWalletToy: unique("uniq_wallet_toy").on(t.walletId, t.toySlug),
  })
);
export type UserToy = typeof userToysTable.$inferSelect;
