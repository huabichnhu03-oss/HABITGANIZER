const PREFIX = "habiganize:feedback_prompt_v1";
export const FEEDBACK_PROMPT_INTERVAL_MS = 15 * 24 * 60 * 60 * 1000;

type PromptState = {
  firstSeenAt: string;
  lastPromptAt: string | null;
};

function storageKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

function readState(userId: string): PromptState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    if (typeof parsed.firstSeenAt !== "string") return null;
    return {
      firstSeenAt: parsed.firstSeenAt,
      lastPromptAt: typeof parsed.lastPromptAt === "string" ? parsed.lastPromptAt : null,
    };
  } catch {
    return null;
  }
}

function writeState(userId: string, state: PromptState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore quota / privacy mode */
  }
}

/** Ensure we have a first-seen timestamp; returns current state. */
export function ensureFeedbackPromptState(userId: string): PromptState {
  const existing = readState(userId);
  if (existing) return existing;
  const fresh: PromptState = { firstSeenAt: new Date().toISOString(), lastPromptAt: null };
  writeState(userId, fresh);
  return fresh;
}

export function shouldShowFeedbackPrompt(userId: string, now = Date.now()): boolean {
  const state = ensureFeedbackPromptState(userId);
  const anchor = state.lastPromptAt ?? state.firstSeenAt;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return false;
  return now - anchorMs >= FEEDBACK_PROMPT_INTERVAL_MS;
}

export function markFeedbackPromptShown(userId: string): void {
  const state = ensureFeedbackPromptState(userId);
  writeState(userId, { ...state, lastPromptAt: new Date().toISOString() });
}
