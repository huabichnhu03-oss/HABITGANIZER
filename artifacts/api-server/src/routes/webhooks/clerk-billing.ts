import type { Request, Response } from "express";
import { verifyWebhook } from "@clerk/express/webhooks";
import { and, eq } from "drizzle-orm";
import { db, userSubscriptionsTable } from "@workspace/db";
import { mapClerkPlanSlug, mapClerkSubscriptionStatus } from "../../lib/billing-seed";

type Payer = { user_id?: string | null; organization_id?: string | null };

function walletIdFromPayer(payer: Payer | undefined | null): string | null {
  return payer?.user_id ?? null;
}

async function upsertFromSubscription(data: {
  id: string;
  status?: string;
  payer?: Payer;
  items?: Array<{
    plan?: { slug?: string };
    period_start?: number | null;
    period_end?: number | null;
    interval?: string | null;
  }>;
}): Promise<void> {
  const walletId = walletIdFromPayer(data.payer);
  if (!walletId) return;

  const planSlug = mapClerkPlanSlug(data.items?.[0]?.plan?.slug);
  if (!planSlug || planSlug === "free") {
    await db
      .update(userSubscriptionsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active"),
        ),
      );
    return;
  }

  const status = mapClerkSubscriptionStatus(data.status);
  const item = data.items?.[0];
  const billingCycle =
    item?.interval === "year" || item?.interval === "annual" ? "yearly" : "monthly";
  const periodStart = item?.period_start ? new Date(item.period_start * 1000) : new Date();
  const periodEnd = item?.period_end
    ? new Date(item.period_end * 1000)
    : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [existing] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.clerkSubscriptionId, data.id))
    .limit(1);

  if (existing) {
    await db
      .update(userSubscriptionsTable)
      .set({
        planSlug,
        status,
        billingCycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: status === "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(userSubscriptionsTable.id, existing.id));
    return;
  }

  // Expire any other active rows for this wallet, then insert.
  await db
    .update(userSubscriptionsTable)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(userSubscriptionsTable.walletId, walletId),
        eq(userSubscriptionsTable.status, "active"),
      ),
    );

  await db.insert(userSubscriptionsTable).values({
    walletId,
    planSlug,
    status,
    billingCycle,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    clerkSubscriptionId: data.id,
  });
}

async function markCancelledForPayerPlan(data: {
  payer?: Payer;
  plan?: { slug?: string };
}): Promise<void> {
  const walletId = walletIdFromPayer(data.payer);
  const planSlug = mapClerkPlanSlug(data.plan?.slug);
  if (!walletId) return;

  if (planSlug && planSlug !== "free") {
    await db
      .update(userSubscriptionsTable)
      .set({
        status: "cancelled",
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userSubscriptionsTable.walletId, walletId),
          eq(userSubscriptionsTable.status, "active"),
          eq(userSubscriptionsTable.planSlug, planSlug),
        ),
      );
    return;
  }

  await db
    .update(userSubscriptionsTable)
    .set({
      status: "cancelled",
      cancelAtPeriodEnd: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userSubscriptionsTable.walletId, walletId),
        eq(userSubscriptionsTable.status, "active"),
      ),
    );
}

export async function clerkBillingWebhookHandler(req: Request, res: Response): Promise<void> {
  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    req.log?.warn({ err }, "Clerk webhook verification failed");
    res.status(400).send("Verification failed");
    return;
  }

  try {
    switch (evt.type) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.active":
      case "subscription.pastDue": {
        await upsertFromSubscription(evt.data as Parameters<typeof upsertFromSubscription>[0]);
        break;
      }
      case "subscriptionItem.canceled":
      case "subscriptionItem.ended": {
        await markCancelledForPayerPlan(evt.data as Parameters<typeof markCancelledForPayerPlan>[0]);
        break;
      }
      case "subscriptionItem.pastDue": {
        const walletId = walletIdFromPayer(
          (evt.data as { payer?: Payer }).payer,
        );
        if (walletId) {
          await db
            .update(userSubscriptionsTable)
            .set({ status: "past_due", updatedAt: new Date() })
            .where(
              and(
                eq(userSubscriptionsTable.walletId, walletId),
                eq(userSubscriptionsTable.status, "active"),
              ),
            );
        }
        break;
      }
      default:
        break;
    }
    res.status(200).send("OK");
  } catch (err) {
    req.log?.error({ err, type: evt.type }, "Clerk billing webhook handler failed");
    res.status(500).send("Handler failed");
  }
}
