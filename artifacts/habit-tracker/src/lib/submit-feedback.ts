import { customFetch } from "@workspace/api-client-react";

export type FeedbackSource = "settings" | "prompt";

export async function submitFeedback(input: {
  message: string;
  rating?: number | null;
  source: FeedbackSource;
  platform?: "web" | "ios" | "android";
}): Promise<void> {
  const message = input.message.trim();
  const rating = input.rating ?? null;
  if (!message && rating == null) {
    throw new Error("Please include a message or a rating.");
  }

  await customFetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      rating,
      source: input.source,
      platform: input.platform ?? "web",
    }),
  });
}
