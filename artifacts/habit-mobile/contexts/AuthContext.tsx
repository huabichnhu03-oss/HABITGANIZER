import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSession,
  loadAccount,
  loadSession,
  normalizeUsername,
  saveAccount,
  saveSession,
  sha256Hex,
  validatePassword,
  validateUsername,
} from "@/lib/auth";

export type AuthStatus = "loading" | "logged_in" | "logged_out";

interface AuthContextValue {
  status: AuthStatus;
  username: string | null;
  hasAccount: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  createAccount: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  renameUsername: (newUsername: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const acct = await loadAccount();
      const session = await loadSession();
      if (cancelled) return;
      const isLoggedIn = !!acct && !!session && session === acct.username;
      setHasAccount(!!acct);
      setUsername(isLoggedIn ? acct!.username : null);
      setStatus(isLoggedIn ? "logged_in" : "logged_out");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createAccount = useCallback(async (rawName: string, password: string) => {
    const usernameError = validateUsername(rawName);
    if (usernameError) throw new Error(usernameError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    const trimmed = normalizeUsername(rawName);
    const existing = await loadAccount();
    if (existing) {
      throw new Error("An account already exists on this device. Sign in instead.");
    }
    const passwordHash = sha256Hex(password);
    await saveAccount({ username: trimmed, passwordHash });
    await saveSession(trimmed);
    setHasAccount(true);
    setUsername(trimmed);
    setStatus("logged_in");
  }, []);

  const signIn = useCallback(async (rawName: string, password: string) => {
    const trimmed = normalizeUsername(rawName);
    if (!trimmed || !password) {
      throw new Error("Please enter your username and password.");
    }
    const acct = await loadAccount();
    if (!acct) {
      throw new Error("No account on this device yet — create one first.");
    }
    if (acct.username.toLowerCase() !== trimmed.toLowerCase()) {
      throw new Error("Wrong username or password.");
    }
    const hash = sha256Hex(password);
    if (hash !== acct.passwordHash) {
      throw new Error("Wrong username or password.");
    }
    await saveSession(acct.username);
    setUsername(acct.username);
    setStatus("logged_in");
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setUsername(null);
    setStatus("logged_out");
  }, []);

  const renameUsername = useCallback(async (newName: string) => {
    const usernameError = validateUsername(newName);
    if (usernameError) throw new Error(usernameError);
    const trimmed = normalizeUsername(newName);
    const acct = await loadAccount();
    if (!acct) throw new Error("No account found.");
    const updated = { ...acct, username: trimmed };
    await saveAccount(updated);
    await saveSession(trimmed);
    setUsername(trimmed);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      username,
      hasAccount,
      signIn,
      createAccount,
      signOut,
      renameUsername,
    }),
    [status, username, hasAccount, signIn, createAccount, signOut, renameUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
