import { Router } from "express";

const router = Router();

const MESSAGE_MAX = 2000;
const RATING_MIN = 1;
const RATING_MAX = 5;
const SOURCES = new Set(["settings", "prompt"]);
const PLATFORMS = new Set(["web", "ios", "android"]);

router.post("/feedback", async (req, res) => {
  const walletId = req.walletId;
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim().slice(0, MESSAGE_MAX) : "";
  const ratingRaw = req.body?.rating;
  const rating =
    typeof ratingRaw === "number" && Number.isInteger(ratingRaw) ? ratingRaw : null;
  const source =
    typeof req.body?.source === "string" && SOURCES.has(req.body.source)
      ? req.body.source
      : "settings";
  const platform =
    typeof req.body?.platform === "string" && PLATFORMS.has(req.body.platform)
      ? req.body.platform
      : "web";

  if (!message && rating == null) {
    res.status(400).json({ error: "Please include a message or a rating." });
    return;
  }
  if (rating != null && (rating < RATING_MIN || rating > RATING_MAX)) {
    res.status(400).json({ error: `Rating must be between ${RATING_MIN} and ${RATING_MAX}.` });
    return;
  }

  req.log.info(
    {
      event: "user_feedback",
      walletId,
      source,
      platform,
      rating,
      messageLength: message.length,
      message: message || undefined,
    },
    "User feedback received",
  );

  res.status(201).json({ ok: true });
});

export default router;
