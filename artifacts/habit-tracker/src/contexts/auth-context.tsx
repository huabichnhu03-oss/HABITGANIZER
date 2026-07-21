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

interface AuthContextValue {
  username: string | null;
  isLoggedIn: boolean;
  hasAccount: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  createAccount: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  renameUsername: (newUsername: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasAccount, setHasAccount] = useState<boolean>(() => loadAccount() !== null);
  const [username, setUsername] = useState<string | null>(() => {
    const acct = loadAccount();
    const session = loadSession();
    return acct && session && session === acct.username ? acct.username : null;
  });

  // Keep state in sync if storage is changed in another tab.
  useEffect(() => {
    const handler = () => {
      const acct = loadAccount();
      const session = loadSession();
      setHasAccount(acct !== null);
      setUsername(acct && session && session === acct.username ? acct.username : null);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const createAccount = useCallback(async (rawName: string, password: string) => {
    const usernameError = validateUsername(rawName);
    if (usernameError) throw new Error(usernameError);
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    const trimmed = normalizeUsername(rawName);
    const existing = loadAccount();
    if (existing) {
      throw new Error("An account already exists on this device. Sign in instead.");
    }
    const passwordHash = await sha256Hex(password);
    saveAccount({ username: trimmed, passwordHash });
    saveSession(trimmed);
    setHasAccount(true);
    setUsername(trimmed);
  }, []);

  const signIn = useCallback(async (rawName: string, password: string) => {
    const trimmed = normalizeUsername(rawName);
    if (!trimmed || !password) {
      throw new Error("Please enter your username and password.");
    }
    const acct = loadAccount();
    if (!acct) {
      throw new Error("No account on this device yet — create one first.");
    }
    if (acct.username.toLowerCase() !== trimmed.toLowerCase()) {
      throw new Error("Wrong username or password.");
    }
    const hash = await sha256Hex(password);
    if (hash !== acct.passwordHash) {
      throw new Error("Wrong username or password.");
    }
    saveSession(acct.username);
    setUsername(acct.username);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUsername(null);
  }, []);

  const renameUsername = useCallback(async (newName: string) => {
    const usernameError = validateUsername(newName);
    if (usernameError) throw new Error(usernameError);
    const trimmed = normalizeUsername(newName);
    const acct = loadAccount();
    if (!acct) throw new Error("No account found.");
    const updated = { ...acct, username: trimmed };
    saveAccount(updated);
    saveSession(trimmed);
    setUsername(trimmed);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      username,
      isLoggedIn: username !== null,
      hasAccount,
      signIn,
      createAccount,
      signOut,
      renameUsername,
    }),
    [username, hasAccount, signIn, createAccount, signOut, renameUsername],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
