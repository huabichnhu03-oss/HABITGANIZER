import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  coinPacksTable,
} from "@workspace/db";

const PLAN_CATALOG = [
  {
    slug: "free",
    name: "Free",
    description: "Start building habits with your first pups",
    priceMonthly: 0,
    priceYearly: 0,
    features: ["Community support", "Core habit tracking"],
    maxHabits: 5,
    maxPets: 3,
    exclusivePets: false,
    adFree: false,
    prioritySupport: false,
    advancedAnalytics: false,
    sortOrder: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "More habits, more pups, fewer limits",
    priceMonthly: 499,
    priceYearly: 4790,
    features: ["Habit reminders", "Friend challenges"],
    maxHabits: 20,
    maxPets: 8,
    exclusivePets: false,
    adFree: true,
    prioritySupport: false,
    advancedAnalytics: false,
    sortOrder: 1,
  },
  {
    slug: "premium",
    name: "Premium",
    description: "Exclusive pets, detailed stats, and priority support",
    priceMonthly: 999,
    priceYearly: 9590,
    features: ["Exclusive pets", "Detailed habit stats", "Priority support"],
    maxHabits: -1,
    maxPets: -1,
    exclusivePets: true,
    adFree: true,
    prioritySupport: true,
    advancedAnalytics: true,
    sortOrder: 2,
  },
  {
    slug: "ultimate",
    name: "Ultimate",
    description: "Everything unlocked for serious habit builders",
    priceMonthly: 1499,
    priceYearly: 14390,
    features: ["Everything in Premium", "Early access to new pups"],
    maxHabits: -1,
    maxPets: -1,
    exclusivePets: true,
    adFree: true,
    prioritySupport: true,
    advancedAnalytics: true,
    sortOrder: 3,
  },
] as const;

const COIN_PACK_CATALOG = [
  {
    slug: "pouch",
    name: "Coin Pouch",
    description: "A small boost for treats and toys",
    coins: 500,
    bonusCoins: 0,
    price: 99,
    emoji: "🪙",
    popular: false,
    sortOrder: 0,
  },
  {
    slug: "bag",
    name: "Coin Bag",
    description: "Enough for a new pup or two",
    coins: 1200,
    bonusCoins: 100,
    price: 199,
    emoji: "💰",
    popular: false,
    sortOrder: 1,
  },
  {
    slug: "chest",
    name: "Treasure Chest",
    description: "Best everyday value",
    coins: 3000,
    bonusCoins: 500,
    price: 499,
    emoji: "🏆",
    popular: true,
    sortOrder: 2,
  },
  {
    slug: "vault",
    name: "Gold Vault",
    description: "Stock up for the whole kennel",
    coins: 8000,
    bonusCoins: 1500,
    price: 999,
    emoji: "🏦",
    popular: false,
    sortOrder: 3,
  },
  {
    slug: "hoard",
    name: "Dragon Hoard",
    description: "Maximum coins, maximum fun",
    coins: 20000,
    bonusCoins: 5000,
    price: 1999,
    emoji: "🐉",
    popular: false,
    sortOrder: 4,
  },
] as const;

/** Idempotent seed for local plan/pack catalogs (Clerk Billing is source of paid checkout). */
export async function ensureBillingSeed(): Promise<void> {
  for (const plan of PLAN_CATALOG) {
    await db
      .insert(subscriptionPlansTable)
      .values({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: [...plan.features],
        maxHabits: plan.maxHabits,
        maxPets: plan.maxPets,
        exclusivePets: plan.exclusivePets,
        adFree: plan.adFree,
        prioritySupport: plan.prioritySupport,
        advancedAnalytics: plan.advancedAnalytics,
        sortOrder: plan.sortOrder,
      })
      .onConflictDoUpdate({
        target: subscriptionPlansTable.slug,
        set: {
          name: plan.name,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          features: [...plan.features],
          maxHabits: plan.maxHabits,
          maxPets: plan.maxPets,
          exclusivePets: plan.exclusivePets,
          adFree: plan.adFree,
          prioritySupport: plan.prioritySupport,
          advancedAnalytics: plan.advancedAnalytics,
          sortOrder: plan.sortOrder,
        },
      });
  }

  for (const pack of COIN_PACK_CATALOG) {
    await db
      .insert(coinPacksTable)
      .values({ ...pack })
      .onConflictDoUpdate({
        target: coinPacksTable.slug,
        set: {
          name: pack.name,
          description: pack.description,
          coins: pack.coins,
          bonusCoins: pack.bonusCoins,
          price: pack.price,
          emoji: pack.emoji,
          popular: pack.popular,
          sortOrder: pack.sortOrder,
        },
      });
  }
}

/** Map Clerk Billing plan slug → local catalog slug used for feature gates. */
export function mapClerkPlanSlug(slug: string | undefined | null): string | null {
  if (!slug) return null;
  const normalized = slug.replace(/^org:/, "").toLowerCase();
  if (normalized === "free_user" || normalized === "free_org" || normalized === "free") {
    return "free";
  }
  const known = PLAN_CATALOG.find((p) => p.slug === normalized);
  return known?.slug ?? normalized;
}

export function mapClerkSubscriptionStatus(status: string | undefined | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "cancelled":
      return "cancelled";
    case "ended":
    case "expired":
      return "expired";
    case "incomplete":
    case "abandoned":
    case "upcoming":
      return status === "upcoming" ? "active" : "incomplete";
    default:
      return status || "active";
  }
}
