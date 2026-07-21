const ACCOUNT_KEY = "habiganize.account";
const SESSION_KEY = "habiganize.session";

export interface StoredAccount {
  username: string;
  passwordHash: string;
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function loadAccount(): StoredAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.username === "string" &&
      typeof parsed.passwordHash === "string"
    ) {
      return parsed as StoredAccount;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAccount(account: StoredAccount): void {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function clearAccount(): void {
  localStorage.removeItem(ACCOUNT_KEY);
}

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(username: string): void {
  localStorage.setItem(SESSION_KEY, username);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function normalizeUsername(name: string): string {
  return name.trim();
}

export function validateUsername(name: string): string | null {
  const trimmed = normalizeUsername(name);
  if (!trimmed) return "Please enter a username.";
  if (trimmed.length > 30) return "Username must be 30 characters or fewer.";
  return null;
}

export function validatePassword(pw: string): string | null {
  if (!pw || !pw.trim()) return "Please enter a password.";
  if (pw.length < 4) return "Password must be at least 4 characters.";
  return null;
}
