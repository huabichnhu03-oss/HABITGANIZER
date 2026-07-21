import React, { useEffect, useState } from "react";
import { Star, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type Mode = "login" | "create";

export function AuthPage() {
  const { hasAccount, signIn, createAccount } = useAuth();
  const [mode, setMode] = useState<Mode>(hasAccount ? "login" : "create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setError(null);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await createAccount(username, password);
      } else {
        await signIn(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border-brutal shadow-brutal rounded-3xl overflow-hidden">
        <header className="bg-accent border-b-[3px] border-foreground p-6 flex items-center gap-3">
          <Star className="w-8 h-8 fill-foreground" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">HABIGANIZE</h1>
            <p className="font-bold text-sm text-foreground/70">
              {mode === "create" ? "Create your account" : "Welcome back"}
            </p>
          </div>
        </header>

        <div className="flex border-b-[3px] border-foreground" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "create"}
            data-testid="auth-tab-create"
            onClick={() => setMode("create")}
            className={cn(
              "flex-1 py-3 font-black uppercase tracking-wide text-sm transition-colors flex items-center justify-center gap-2",
              mode === "create" ? "bg-primary text-white" : "bg-white hover:bg-muted",
            )}
          >
            <UserPlus className="w-4 h-4" /> Create
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            data-testid="auth-tab-login"
            onClick={() => setMode("login")}
            className={cn(
              "flex-1 py-3 font-black uppercase tracking-wide text-sm transition-colors flex items-center justify-center gap-2 border-l-[3px] border-foreground",
              mode === "login" ? "bg-primary text-white" : "bg-white hover:bg-muted",
            )}
          >
            <LogIn className="w-4 h-4" /> Log in
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider mb-1 block">Username</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="auth-username"
              className="w-full px-4 py-3 border-brutal-sm rounded-xl bg-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. taylor"
              maxLength={30}
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wider mb-1 block">Password</span>
            <input
              type="password"
              autoComplete={mode === "create" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="auth-password"
              className="w-full px-4 py-3 border-brutal-sm rounded-xl bg-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={mode === "create" ? "At least 4 characters" : "Your password"}
            />
          </label>

          {error && (
            <p
              data-testid="auth-error"
              role="alert"
              className="text-sm font-bold text-destructive bg-destructive/10 border-2 border-destructive rounded-xl px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            data-testid="auth-submit"
            className={cn(
              "w-full py-3 rounded-xl border-brutal-sm shadow-brutal-sm font-black uppercase tracking-wide text-base bg-primary text-white transition-transform",
              submitting ? "opacity-60" : "hover:-translate-y-0.5 active:translate-y-0.5",
            )}
          >
            {mode === "create" ? "Create account" : "Log in"}
          </button>

          <p className="text-xs font-bold text-foreground/60 text-center pt-2">
            Account is stored only on this device.
          </p>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;
