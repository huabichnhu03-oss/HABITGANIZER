const PREFIX = "habiganize:onboarding_v1";

export function getOnboardingStorageKey(userId: string): string {
  return `${PREFIX}:${userId}`;
}

export function isOnboardingCompleted(userId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(getOnboardingStorageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getOnboardingStorageKey(userId), "1");
  } catch {
    /* ignore quota / privacy mode */
  }
}
