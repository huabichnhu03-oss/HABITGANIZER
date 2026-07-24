import Stripe from "stripe";

let stripe: Stripe | null = null;

/** Lazy Stripe client. Returns null when STRIPE_SECRET_KEY is unset (dev without payments). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripe) {
    stripe = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripe;
}

export function requireStripe(): Stripe {
  const client = getStripe();
  if (!client) {
    throw Object.assign(new Error("Stripe is not configured (missing STRIPE_SECRET_KEY)"), {
      status: 503,
    });
  }
  return client;
}

/** Public app origin for Checkout success/cancel URLs. */
export function resolveAppOrigin(req: { get(name: string): string | undefined; headers: { origin?: string } }): string {
  const fromEnv = process.env.APP_URL?.trim() || process.env.PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const origin = req.headers.origin || req.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const cors = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  if (cors) return cors.replace(/\/+$/, "");

  return "http://localhost:5173";
}
