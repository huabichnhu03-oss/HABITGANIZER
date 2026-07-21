import { Router } from "express";
import { db } from "@workspace/db";
import { financialRateLimit } from "../middlewares/rate-limit";
import {
  subscriptionPlansTable,
  userSubscriptionsTable,
  coinPacksTable,
  coinPurchasesTable,
  exclusivePetsTable,
  achievementsTable,
  userAchievementsTable,
  walletsTable,
  petsTable,
  userPetsTable,
} from "@workspace/db";
import { eq, and, sql, asc, desc, gte, lte, isNull, or } from "drizzle-orm";
import { sendZodError } from "../lib/errors";

const router = Router();

// ============================================================
// SUBSCRIPTION PLANS
// ============================================================

router.get("/plans", async (req, res) => {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlansTable)
      .orderBy(asc(subscriptionPlansTable.sortOrder));

    res.json(
      plans.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        features: p.features,
        maxHabits: p.maxHabits,
        maxPets: p.maxPets,
        exclusivePets: p.exclusivePets,
        adFree: p.adFree,
        prioritySupport: p.prioritySupport,
        advancedAnalytics: p.advancedAnalytics,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load subscription plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// USER SUBSCRIPTION
// ============================================================

router.get("/subscription", async (req, res) => {
  const walletId = req.walletId;
  try {
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      )
      .orderBy(desc(userSubscriptionsTable.createdAt))
      .limit(1);

    if (!sub) {
      // Return free tier info
      res.json({
        plan: "free",
        status: "active",
        features: {
          maxHabits: 5,
          maxPets: 3,
          exclusivePets: false,
          adFree: false,
          prioritySupport: false,
          advancedAnalytics: false,
        },
      });
      return;
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, sub.planSlug));

    res.json({
      id: sub.id,
      plan: sub.planSlug,
      planName: plan?.name,
      status: sub.status,
      billingCycle: sub.billingCycle,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      features: {
        maxHabits: plan?.maxHabits ?? 5,
        maxPets: plan?.maxPets ?? 3,
        exclusivePets: plan?.exclusivePets ?? false,
        adFree: plan?.adFree ?? false,
        prioritySupport: plan?.prioritySupport ?? false,
        advancedAnalytics: plan?.advancedAnalytics ?? false,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Subscribe to a plan (simulated - in production, integrate with Stripe)
router.post("/subscribe", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const { planSlug, billingCycle = "monthly" } = req.body;

  if (!planSlug) {
    res.status(400).json({ error: "Plan slug is required" });
    return;
  }

  if (!["monthly", "yearly"].includes(billingCycle)) {
    res.status(400).json({ error: "Billing cycle must be 'monthly' or 'yearly'" });
    return;
  }

  try {
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, planSlug));

    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    // Check for existing active subscription
    const [existingSub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      );

    if (existingSub) {
      res.status(400).json({ error: "You already have an active subscription. Cancel first to change plans." });
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === "monthly") {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // In production, this would create a Stripe subscription
    // For now, simulate the subscription creation
    const [subscription] = await db
      .insert(userSubscriptionsTable)
      .values({
        walletId,
        planSlug,
        status: "active",
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        // stripeSubscriptionId: would come from Stripe
        // stripeCustomerId: would come from Stripe
      })
      .returning();

    res.status(201).json({
      id: subscription.id,
      plan: planSlug,
      planName: plan.name,
      status: "active",
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      features: {
        maxHabits: plan.maxHabits,
        maxPets: plan.maxPets,
        exclusivePets: plan.exclusivePets,
        adFree: plan.adFree,
        prioritySupport: plan.prioritySupport,
        advancedAnalytics: plan.advancedAnalytics,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel subscription (at period end)
router.post("/subscription/cancel", async (req, res) => {
  const walletId = req.walletId;
  try {
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      );

    if (!sub) {
      res.status(404).json({ error: "No active subscription found" });
      return;
    }

    await db
      .update(userSubscriptionsTable)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(userSubscriptionsTable.id, sub.id));

    res.json({
      message: "Subscription will be cancelled at the end of the current billing period",
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to cancel subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reactivate cancelled subscription
router.post("/subscription/reactivate", async (req, res) => {
  const walletId = req.walletId;
  try {
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active"),
          eq(userSubscriptionsTable.cancelAtPeriodEnd, true)
        )
      );

    if (!sub) {
      res.status(404).json({ error: "No cancellable subscription found" });
      return;
    }

    await db
      .update(userSubscriptionsTable)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(eq(userSubscriptionsTable.id, sub.id));

    res.json({ message: "Subscription reactivated successfully" });
  } catch (err) {
    req.log.error({ err }, "Failed to reactivate subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// COIN PACKS
// ============================================================

router.get("/coin-packs", async (req, res) => {
  try {
    const packs = await db
      .select()
      .from(coinPacksTable)
      .orderBy(asc(coinPacksTable.sortOrder));

    res.json(
      packs.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        coins: p.coins,
        bonusCoins: p.bonusCoins,
        totalCoins: p.coins + p.bonusCoins,
        price: p.price,
        emoji: p.emoji,
        popular: p.popular,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load coin packs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Purchase coins (simulated - in production, integrate with Stripe)
router.post("/coin-packs/buy/:slug", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const { slug } = req.params;

  if (!slug) {
    res.status(400).json({ error: "Pack slug is required" });
    return;
  }

  try {
    const [pack] = await db
      .select()
      .from(coinPacksTable)
      .where(eq(coinPacksTable.slug, slug));

    if (!pack) {
      res.status(404).json({ error: "Coin pack not found" });
      return;
    }

    const totalCoins = pack.coins + pack.bonusCoins;

    // In production, this would process payment via Stripe
    // For now, simulate the purchase
    const result = await db.transaction(async (tx) => {
      // Award coins to wallet
      await tx
        .insert(walletsTable)
        .values({ id: walletId, coins: totalCoins })
        .onConflictDoUpdate({
          target: walletsTable.id,
          set: {
            coins: sql`${walletsTable.coins} + ${totalCoins}`,
            updatedAt: new Date(),
          },
        });

      // Record purchase
      const [purchase] = await tx
        .insert(coinPurchasesTable)
        .values({
          walletId,
          packSlug: slug,
          coinsAwarded: totalCoins,
          amountPaid: pack.price,
          status: "completed",
          // stripePaymentIntentId: would come from Stripe
        })
        .returning();

      // Get updated wallet
      const [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.id, walletId));

      return { purchase, wallet };
    });

    res.status(201).json({
      coinsAwarded: totalCoins,
      bonusCoins: pack.bonusCoins,
      wallet: {
        coins: result.wallet?.coins ?? 0,
        food: result.wallet?.food ?? 0,
        water: result.wallet?.water ?? 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to purchase coin pack");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get purchase history
router.get("/purchases", async (req, res) => {
  const walletId = req.walletId;
  try {
    const purchases = await db
      .select({
        id: coinPurchasesTable.id,
        packSlug: coinPurchasesTable.packSlug,
        coinsAwarded: coinPurchasesTable.coinsAwarded,
        amountPaid: coinPurchasesTable.amountPaid,
        status: coinPurchasesTable.status,
        createdAt: coinPurchasesTable.createdAt,
        packName: coinPacksTable.name,
        packEmoji: coinPacksTable.emoji,
      })
      .from(coinPurchasesTable)
      .leftJoin(coinPacksTable, eq(coinPurchasesTable.packSlug, coinPacksTable.slug))
      .where(eq(coinPurchasesTable.walletId, walletId))
      .orderBy(desc(coinPurchasesTable.createdAt))
      .limit(50);

    res.json(purchases);
  } catch (err) {
    req.log.error({ err }, "Failed to load purchase history");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// EXCLUSIVE PETS
// ============================================================

router.get("/exclusive-pets", async (req, res) => {
  const walletId = req.walletId;
  try {
    // Get user's subscription
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      );

    const userPlan = sub?.planSlug ?? "free";

    // Get all exclusive pets
    const exclusivePets = await db
      .select({
        petSlug: exclusivePetsTable.petSlug,
        requiredPlanSlug: exclusivePetsTable.requiredPlanSlug,
        limitedEdition: exclusivePetsTable.limitedEdition,
        availableUntil: exclusivePetsTable.availableUntil,
        maxOwners: exclusivePetsTable.maxOwners,
        currentOwners: exclusivePetsTable.currentOwners,
        petName: petsTable.name,
        petBreed: petsTable.breed,
        petDescription: petsTable.description,
        petPrice: petsTable.price,
        petImagePath: petsTable.imagePath,
      })
      .from(exclusivePetsTable)
      .innerJoin(petsTable, eq(exclusivePetsTable.petSlug, petsTable.slug))
      .where(
        or(
          isNull(exclusivePetsTable.availableUntil),
          gte(exclusivePetsTable.availableUntil, new Date())
        )
      );

    // Check which pets user owns
    const ownedPets = await db
      .select({ petSlug: userPetsTable.petSlug })
      .from(userPetsTable)
      .where(eq(userPetsTable.walletId, walletId));
    const ownedSet = new Set(ownedPets.map((p) => p.petSlug));

    // Plan hierarchy for access check
    const planHierarchy: Record<string, number> = {
      free: 0,
      pro: 1,
      premium: 2,
      ultimate: 3,
    };
    const userPlanLevel = planHierarchy[userPlan] ?? 0;

    res.json(
      exclusivePets.map((ep) => {
        const requiredLevel = planHierarchy[ep.requiredPlanSlug] ?? 0;
        const hasAccess = userPlanLevel >= requiredLevel;
        const isOwned = ownedSet.has(ep.petSlug);
        const isSoldOut = ep.maxOwners !== null && ep.currentOwners >= ep.maxOwners;

        return {
          slug: ep.petSlug,
          name: ep.petName,
          breed: ep.petBreed,
          description: ep.petDescription,
          price: ep.petPrice,
          imageUrl: ep.petImagePath,
          requiredPlan: ep.requiredPlanSlug,
          limitedEdition: ep.limitedEdition,
          availableUntil: ep.availableUntil,
          maxOwners: ep.maxOwners,
          currentOwners: ep.currentOwners,
          hasAccess,
          isOwned,
          isSoldOut,
          canBuy: hasAccess && !isOwned && !isSoldOut,
        };
      })
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load exclusive pets");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// ACHIEVEMENTS
// ============================================================

router.get("/achievements", async (req, res) => {
  const walletId = req.walletId;
  try {
    // Get user's subscription
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      );

    const isPremium = sub !== null;

    // Get all achievements
    const allAchievements = await db.select().from(achievementsTable);

    // Get user's unlocked achievements
    const unlocked = await db
      .select()
      .from(userAchievementsTable)
      .where(eq(userAchievementsTable.walletId, walletId));
    const unlockedMap = new Map(unlocked.map((a) => [a.achievementSlug, a.unlockedAt]));

    res.json(
      allAchievements
        .filter((a) => !a.premiumOnly || isPremium)
        .map((a) => ({
          slug: a.slug,
          name: a.name,
          description: a.description,
          icon: a.icon,
          rewardCoins: a.rewardCoins,
          premiumOnly: a.premiumOnly,
          unlocked: unlockedMap.has(a.slug),
          unlockedAt: unlockedMap.get(a.slug) ?? null,
        }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to load achievements");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================
// USAGE STATS (for premium analytics)
// ============================================================

router.get("/stats/advanced", async (req, res) => {
  const walletId = req.walletId;
  try {
    // Check if user has premium subscription
    const [sub] = await db
      .select()
      .from(userSubscriptionsTable)
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active")
        )
      );

    if (!sub) {
      res.status(403).json({ error: "Advanced analytics require a premium subscription" });
      return;
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, sub.planSlug));

    if (!plan?.advancedAnalytics) {
      res.status(403).json({ error: "Your plan does not include advanced analytics" });
      return;
    }

    // Get comprehensive stats
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // This would be expanded with actual analytics queries
    // For now, return placeholder structure
    res.json({
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
      habits: {
        totalCompletions: 0, // Would query habit_completions
        completionRate: 0,
        averageMood: null,
        streakDays: 0,
      },
      pets: {
        totalPets: 0, // Would query user_pets
        averageLevel: 0,
        totalFeedings: 0,
      },
      economy: {
        totalCoinsEarned: 0,
        totalCoinsSpent: 0,
        totalPurchases: 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load advanced stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
