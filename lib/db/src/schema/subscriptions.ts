import { pgTable, text, integer, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { walletsTable } from "./rewards";

// Subscription plans
export const subscriptionPlansTable = pgTable("subscription_plans", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceMonthly: integer("price_monthly").notNull(), // in cents
  priceYearly: integer("price_yearly").notNull(), // in cents (discounted)
  features: jsonb("features").$type<string[]>().notNull().default([]),
  maxHabits: integer("max_habits").notNull().default(5), // free tier limit
  maxPets: integer("max_pets").notNull().default(3), // free tier limit
  exclusivePets: boolean("exclusive_pets").notNull().default(false),
  adFree: boolean("ad_free").notNull().default(false),
  prioritySupport: boolean("priority_support").notNull().default(false),
  advancedAnalytics: boolean("advanced_analytics").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

// User subscriptions
export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
  planSlug: text("plan_slug").references(() => subscriptionPlansTable.slug).notNull(),
  status: text("status").notNull().default("active"), // active, cancelled, expired, past_due
  billingCycle: text("billing_cycle").notNull().default("monthly"), // monthly, yearly
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;

// Coin purchase packs
export const coinPacksTable = pgTable("coin_packs", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  coins: integer("coins").notNull(),
  bonusCoins: integer("bonus_coins").notNull().default(0), // extra coins as bonus
  price: integer("price").notNull(), // in cents
  emoji: text("emoji").notNull(),
  popular: boolean("popular").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});
export type CoinPack = typeof coinPacksTable.$inferSelect;

// Coin purchase history
export const coinPurchasesTable = pgTable("coin_purchases", {
  id: serial("id").primaryKey(),
  walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
  packSlug: text("pack_slug").references(() => coinPacksTable.slug).notNull(),
  coinsAwarded: integer("coins_awarded").notNull(),
  amountPaid: integer("amount_paid").notNull(), // in cents
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("completed"), // completed, refunded, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CoinPurchase = typeof coinPurchasesTable.$inferSelect;

// Exclusive pets (only available to premium subscribers)
export const exclusivePetsTable = pgTable("exclusive_pets", {
  petSlug: text("pet_slug").primaryKey(),
  requiredPlanSlug: text("required_plan_slug").references(() => subscriptionPlansTable.slug).notNull(),
  limitedEdition: boolean("limited_edition").notNull().default(false),
  availableUntil: timestamp("available_until", { withTimezone: true }),
  maxOwners: integer("max_owners"), // null = unlimited
  currentOwners: integer("current_owners").notNull().default(0),
});
export type ExclusivePet = typeof exclusivePetsTable.$inferSelect;

// User achievements/badges (premium feature)
export const achievementsTable = pgTable("achievements", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  requirement: text("requirement").notNull(), // JSON string describing requirement
  rewardCoins: integer("reward_coins").notNull().default(0),
  premiumOnly: boolean("premium_only").notNull().default(false),
});
export type Achievement = typeof achievementsTable.$inferSelect;

export const userAchievementsTable = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  walletId: text("wallet_id").references(() => walletsTable.id, { onDelete: "cascade" }).notNull(),
  achievementSlug: text("achievement_slug").references(() => achievementsTable.slug).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});
export type UserAchievement = typeof userAchievementsTable.$inferSelect;

// Zod schemas for validation
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable);
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCoinPackSchema = createInsertSchema(coinPacksTable);
export const insertCoinPurchaseSchema = createInsertSchema(coinPurchasesTable).omit({ id: true, createdAt: true });
