import { Router } from "express";
import { db, donationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { financialRateLimit } from "../middlewares/rate-limit";
import { requireStripe, resolveAppOrigin } from "../lib/stripe";

const router = Router();

const DONATION_PRESETS_CENTS = [300, 500, 1000, 2500] as const;
const MIN_DONATION_CENTS = 100;
const MAX_DONATION_CENTS = 50_000;

router.get("/donations/presets", (_req, res) => {
  res.json({
    currency: "usd",
    amounts: DONATION_PRESETS_CENTS.map((cents) => ({
      cents,
      label: `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`,
    })),
    minCents: MIN_DONATION_CENTS,
    maxCents: MAX_DONATION_CENTS,
  });
});

router.get("/donations/mine", async (req, res) => {
  const walletId = req.walletId;
  try {
    const rows = await db
      .select({
        id: donationsTable.id,
        amountCents: donationsTable.amountCents,
        currency: donationsTable.currency,
        status: donationsTable.status,
        message: donationsTable.message,
        createdAt: donationsTable.createdAt,
        completedAt: donationsTable.completedAt,
      })
      .from(donationsTable)
      .where(eq(donationsTable.walletId, walletId))
      .orderBy(desc(donationsTable.createdAt))
      .limit(20);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list donations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/donations/checkout", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const amountCents = Number(req.body?.amountCents);
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 280) : undefined;

  if (!Number.isInteger(amountCents) || amountCents < MIN_DONATION_CENTS || amountCents > MAX_DONATION_CENTS) {
    res.status(400).json({
      error: `Donation must be between $${(MIN_DONATION_CENTS / 100).toFixed(0)} and $${(MAX_DONATION_CENTS / 100).toFixed(0)}`,
    });
    return;
  }

  try {
    const stripe = requireStripe();
    const origin = resolveAppOrigin(req);

    const [pending] = await db
      .insert(donationsTable)
      .values({
        walletId,
        amountCents,
        currency: "usd",
        status: "pending",
        message: message || null,
      })
      .returning();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Support Habiganize",
              description: "Thank you for supporting Habiganize",
            },
          },
        },
      ],
      success_url: `${origin}/premium?donated=1`,
      cancel_url: `${origin}/premium?donate=cancelled`,
      client_reference_id: walletId,
      metadata: {
        kind: "donation",
        walletId,
        amountCents: String(amountCents),
        donationId: String(pending.id),
        message: message?.slice(0, 200) || "",
      },
    });

    await db
      .update(donationsTable)
      .set({ stripeCheckoutSessionId: session.id })
      .where(eq(donationsTable.id, pending.id));

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    req.log.error({ err }, "Failed to create donation checkout");
    res.status(status).json({
      error:
        status === 503
          ? "Donations are temporarily unavailable. Please try again later."
          : "Failed to start donation checkout",
    });
  }
});

export default router;
