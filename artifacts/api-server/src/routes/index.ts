import { Router, type IRouter } from "express";
import { userScope } from "../middlewares/user-scope";
import { writeRateLimit } from "../middlewares/rate-limit";
import healthRouter from "./health";
import habitsRouter from "./habits";
import groceryItemsRouter from "./grocery-items";
import rewardsRouter, { ensureSeed } from "./rewards";
import healthMetricsRouter from "./health-metrics";
import socialRouter from "./social";
import subscriptionsRouter from "./subscriptions";

const router: IRouter = Router();

// Health check does not require auth — mount it first.
router.use(healthRouter);

// All remaining routes require a valid Clerk session.
router.use(userScope);

// Global write rate limit (G1).
router.use(writeRateLimit);

router.use(habitsRouter);
router.use(groceryItemsRouter);
router.use(rewardsRouter);
router.use(healthMetricsRouter);
router.use(socialRouter);
router.use(subscriptionsRouter);

// Fire-and-forget seed; idempotent.
ensureSeed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to seed rewards data", err);
});

export default router;
