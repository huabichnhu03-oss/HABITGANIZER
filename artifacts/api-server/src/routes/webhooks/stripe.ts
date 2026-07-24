import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import {
  db,
  walletsTable,
  coinPacksTable,
  coinPurchasesTable,
  donationsTable,
} from "@workspace/db";
import { getStripe } from "../../lib/stripe";

async function completeDonation(session: {
  id: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
}): Promise<void> {
  const walletId = session.metadata?.walletId;
  if (!walletId) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const [existing] = await db
    .select()
    .from(donationsTable)
    .where(eq(donationsTable.stripeCheckoutSessionId, session.id))
    .limit(1);

  if (existing?.status === "completed") return;

  if (existing) {
    await db
      .update(donationsTable)
      .set({
        status: "completed",
        amountCents: session.amount_total ?? existing.amountCents,
        currency: session.currency ?? existing.currency,
        stripePaymentIntentId: paymentIntentId,
        completedAt: new Date(),
      })
      .where(eq(donationsTable.id, existing.id));
    return;
  }

  await db.insert(donationsTable).values({
    walletId,
    amountCents: session.amount_total ?? Number(session.metadata?.amountCents ?? 0),
    currency: session.currency ?? "usd",
    status: "completed",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    message: session.metadata?.message || null,
    completedAt: new Date(),
  });
}

async function completeCoinPack(session: {
  id: string;
  payment_intent?: string | { id?: string } | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
}): Promise<void> {
  const walletId = session.metadata?.walletId;
  const packSlug = session.metadata?.packSlug;
  if (!walletId || !packSlug) return;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  if (paymentIntentId) {
    const [dup] = await db
      .select()
      .from(coinPurchasesTable)
      .where(eq(coinPurchasesTable.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    if (dup) return;
  }

  const [pack] = await db
    .select()
    .from(coinPacksTable)
    .where(eq(coinPacksTable.slug, packSlug))
    .limit(1);
  if (!pack) return;

  const totalCoins = pack.coins + pack.bonusCoins;

  await db.transaction(async (tx) => {
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

    await tx.insert(coinPurchasesTable).values({
      walletId,
      packSlug,
      coinsAwarded: totalCoins,
      amountPaid: session.amount_total ?? pack.price,
      stripePaymentIntentId: paymentIntentId,
      status: "completed",
    });
  });
}

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    res.status(503).send("Stripe webhooks not configured");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).send("Missing stripe-signature");
    return;
  }

  let event;
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === "string"
        ? Buffer.from(req.body)
        : Buffer.from(JSON.stringify(req.body ?? {}));
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    req.log?.warn({ err }, "Stripe webhook verification failed");
    res.status(400).send("Verification failed");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const kind = session.metadata?.kind;
      if (kind === "donation") {
        await completeDonation(session);
      } else if (kind === "coin_pack") {
        await completeCoinPack(session);
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    req.log?.error({ err, type: event.type }, "Stripe webhook handler failed");
    res.status(500).send("Handler failed");
  }
}
