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
  petsTable,
  userPetsTable,
  habitsTable,
  habitCompletionsTable,
} from "@workspace/db";
import { eq, and, asc, desc, gte, isNull, or, sql, inArray } from "drizzle-orm";

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

// Subscribe is handled by Clerk Billing (<PricingTable />). Keep endpoint as a clear error.
router.post("/subscribe", financialRateLimit, async (_req, res) => {
  res.status(410).json({
    error:
      "Subscriptions are managed by Clerk Billing. Use the pricing table on /premium to subscribe.",
    code: "use_clerk_billing",
  });
});

// Cancel / reactivate are managed in Clerk UserProfile / Billing UI.
router.post("/subscription/cancel", async (_req, res) => {
  res.status(410).json({
    error: "Manage your subscription in Account → Billing (Clerk).",
    code: "use_clerk_billing",
  });
});

router.post("/subscription/reactivate", async (_req, res) => {
  res.status(410).json({
    error: "Manage your subscription in Account → Billing (Clerk).",
    code: "use_clerk_billing",
  });
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

// Start Stripe Checkout for a coin pack (fulfillment via /api/webhooks/stripe).
router.post("/coin-packs/checkout/:slug", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const slug = typeof req.params.slug === "string" ? req.params.slug : req.params.slug?.[0];

  if (!slug) {
    res.status(400).json({ error: "Pack slug is required" });
    return;
  }

  try {
    const { requireStripe, resolveAppOrigin } = await import("../lib/stripe");
    const stripe = requireStripe();
    const origin = resolveAppOrigin(req);

    const [pack] = await db
      .select()
      .from(coinPacksTable)
      .where(eq(coinPacksTable.slug, slug));

    if (!pack) {
      res.status(404).json({ error: "Coin pack not found" });
      return;
    }

    const totalCoins = pack.coins + pack.bonusCoins;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.price,
            product_data: {
              name: pack.name,
              description: `${totalCoins.toLocaleString()} coins. ${pack.description}`,
            },
          },
        },
      ],
      success_url: `${origin}/premium?coins=1`,
      cancel_url: `${origin}/premium?coins=cancelled`,
      client_reference_id: walletId,
      metadata: {
        kind: "coin_pack",
        walletId,
        packSlug: slug,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    req.log.error({ err }, "Failed to create coin pack checkout");
    res.status(status).json({
      error:
        status === 503
          ? "Coin purchases are temporarily unavailable. Please try again later."
          : "Failed to start coin checkout",
    });
  }
});

/** @deprecated Use POST /coin-packs/checkout/:slug */
router.post("/coin-packs/buy/:slug", financialRateLimit, async (req, res) => {
  res.status(410).json({
    error: "Use Stripe Checkout via POST /coin-packs/checkout/:slug",
    code: "use_stripe_checkout",
  });
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
      res.status(403).json({ error: "Detailed stats require a premium subscription" });
      return;
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.slug, sub.planSlug));

    if (!plan?.advancedAnalytics) {
      res.status(403).json({ error: "Your plan does not include detailed stats" });
      return;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const habits = await db
      .select({ id: habitsTable.id })
      .from(habitsTable)
      .where(and(eq(habitsTable.walletId, walletId), isNull(habitsTable.archivedAt)));
    const habitIds = habits.map((h) => h.id);

    let totalCompletions = 0;
    let completionRate = 0;
    let averageMood: number | null = null;
    let streakDays = 0;

    if (habitIds.length > 0) {
      const [completionRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(habitCompletionsTable)
        .where(
          and(
            inArray(habitCompletionsTable.habitId, habitIds),
            gte(habitCompletionsTable.completedDate, thirtyDaysAgoStr),
          ),
        );
      totalCompletions = completionRow?.count ?? 0;

      const possible = habitIds.length * 30;
      completionRate = possible > 0 ? Math.min(1, totalCompletions / possible) : 0;

      const moodRows = await db
        .select({ mood: habitCompletionsTable.mood })
        .from(habitCompletionsTable)
        .where(
          and(
            inArray(habitCompletionsTable.habitId, habitIds),
            gte(habitCompletionsTable.completedDate, thirtyDaysAgoStr),
          ),
        );
      const moodScore: Record<string, number> = {
        great: 5,
        good: 4,
        okay: 3,
        meh: 2,
        bad: 1,
      };
      const scored = moodRows
        .map((r) => (r.mood ? moodScore[r.mood] : null))
        .filter((n): n is number => n != null);
      if (scored.length > 0) {
        averageMood = scored.reduce((a, b) => a + b, 0) / scored.length;
      }

      // Approximate streak: consecutive calendar days (from today back) with ≥1 completion.
      const todayStr = now.toISOString().slice(0, 10);
      const recentDates = await db
        .select({ completedDate: habitCompletionsTable.completedDate })
        .from(habitCompletionsTable)
        .where(inArray(habitCompletionsTable.habitId, habitIds));
      const dateSet = new Set(recentDates.map((r) => r.completedDate));
      let cursor = todayStr;
      // If today has no completion yet, start from yesterday so a mid-day view doesn't zero the streak.
      if (!dateSet.has(cursor)) {
        const y = new Date(`${cursor}T12:00:00Z`);
        y.setUTCDate(y.getUTCDate() - 1);
        cursor = y.toISOString().slice(0, 10);
      }
      while (dateSet.has(cursor)) {
        streakDays += 1;
        const d = new Date(`${cursor}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        cursor = d.toISOString().slice(0, 10);
      }
    }

    const userPets = await db
      .select({
        level: userPetsTable.level,
        hunger: userPetsTable.hunger,
      })
      .from(userPetsTable)
      .where(eq(userPetsTable.walletId, walletId));
    const totalPets = userPets.length;
    const averageLevel =
      totalPets > 0 ? userPets.reduce((s, p) => s + (p.level ?? 1), 0) / totalPets : 0;

    const [purchaseAgg] = await db
      .select({
        totalPurchases: sql<number>`count(*)::int`,
        totalCoins: sql<number>`coalesce(sum(${coinPurchasesTable.coinsAwarded}), 0)::int`,
      })
      .from(coinPurchasesTable)
      .where(
        and(
          eq(coinPurchasesTable.walletId, walletId),
          eq(coinPurchasesTable.status, "completed"),
        ),
      );

    res.json({
      period: {
        start: thirtyDaysAgo.toISOString(),
        end: now.toISOString(),
      },
      habits: {
        totalCompletions,
        completionRate,
        averageMood,
        streakDays,
      },
      pets: {
        totalPets,
        averageLevel,
        // Feedings are not stored as a ledger; surface care health instead.
        wellCaredPets: userPets.filter((p) => (p.hunger ?? 0) >= 50).length,
      },
      economy: {
        totalCoinsFromPurchases: purchaseAgg?.totalCoins ?? 0,
        totalPurchases: purchaseAgg?.totalPurchases ?? 0,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load advanced stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
