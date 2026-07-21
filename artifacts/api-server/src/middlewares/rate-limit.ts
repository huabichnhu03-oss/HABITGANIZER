import rateLimit from "express-rate-limit";

/**
 * General write-rate limiter — 60 requests per minute per user.
 * Applied to all mutating endpoints (POST/PUT/PATCH/DELETE).
 */
export const writeRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.walletId ?? req.ip ?? "unknown",
  message: { error: "Too many requests, please try again later" },
});

/**
 * Strict limiter for coin-affecting endpoints — 10 requests per minute per user.
 * Prevents automated coin farming via concurrent requests.
 */
export const financialRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.walletId ?? req.ip ?? "unknown",
  message: { error: "Too many requests, please try again later" },
});

/**
 * Limiter for friend requests — 20 per minute per user.
 */
export const socialRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.walletId ?? req.ip ?? "unknown",
  message: { error: "Too many requests, please try again later" },
});

/**
 * Limiter for expensive read queries (leaderboard) — 30 per minute per user.
 */
export const readRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.walletId ?? req.ip ?? "unknown",
  message: { error: "Too many requests, please try again later" },
});
