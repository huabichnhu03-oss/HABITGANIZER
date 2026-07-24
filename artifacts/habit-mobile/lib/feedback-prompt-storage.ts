import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "habiganize:feedback_prompt_v1";
export const FEEDBACK_PROMPT_INTERVAL_MS = 15 * 24 * 60 * 60 * 1000;

type PromptState = {
  firstSeenAt: string;
  lastPromptAt: string | null;
};

function storageKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

async function readState(userId: string): Promise<PromptState | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
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

async function writeState(userId: string, state: PromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export async function ensureFeedbackPromptState(userId: string): Promise<PromptState> {
  const existing = await readState(userId);
  if (existing) return existing;
  const fresh: PromptState = { firstSeenAt: new Date().toISOString(), lastPromptAt: null };
  await writeState(userId, fresh);
  return fresh;
}

export async function shouldShowFeedbackPrompt(userId: string, now = Date.now()): Promise<boolean> {
  const state = await ensureFeedbackPromptState(userId);
  const anchor = state.lastPromptAt ?? state.firstSeenAt;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return false;
  return now - anchorMs >= FEEDBACK_PROMPT_INTERVAL_MS;
}

export async function markFeedbackPromptShown(userId: string): Promise<void> {
  const state = await ensureFeedbackPromptState(userId);
  await writeState(userId, { ...state, lastPromptAt: new Date().toISOString() });
}
