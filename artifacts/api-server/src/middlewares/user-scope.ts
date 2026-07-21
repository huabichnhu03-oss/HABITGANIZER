import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { walletsTable } from "@workspace/db";
import { logger } from "../lib/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      walletId: string;
    }
  }
}

/**
 * Require a valid Clerk session. Extracts the authenticated userId and
 * attaches it to req.walletId so all downstream route handlers can use it
 * for per-user data scoping without repeating the auth check.
 *
 * Also ensures the wallet row exists for the user (idempotent upsert),
 * so FK constraints on child tables (habits, health_goals, etc.) are
 * never violated for first-time users.
 *
 * Returns 401 if the request carries no valid Clerk session.
 */
export async function userScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.walletId = auth.userId;

  // Ensure the wallet row exists before any route handler runs.
  // This is idempotent — onConflictDoNothing makes it safe to call every request.
  try {
    await db
      .insert(walletsTable)
      .values({ id: auth.userId, coins: 0, food: 0, water: 0 })
      .onConflictDoNothing();
  } catch (err) {
    // Log but don't block — the route handler will fail clearly if the wallet is missing.
    logger.warn({ err, userId: auth.userId }, "Wallet upsert failed");
  }

  next();
}
