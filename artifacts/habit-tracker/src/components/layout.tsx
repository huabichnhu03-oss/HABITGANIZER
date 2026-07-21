import React, { useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Home, List, BarChart2, Star, PawPrint, Heart, LogOut, History as HistoryIcon, UserRound, Users, Trophy, Crown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import {
  listHabits,
  getDashboard,
  listShop,
  getCollection,
  getHealthSummary,
  getHistory,
  getFriendProfile,
  listFriendRequests,
  listFriends,
  getGetHistoryQueryKey,
  getListHabitsQueryKey,
  getGetDashboardQueryKey,
  getListShopQueryKey,
  getGetCollectionQueryKey,
  getGetHealthSummaryQueryKey,
  getGetFriendProfileQueryKey,
  getListFriendRequestsQueryKey,
  getListFriendsQueryKey,
} from "@workspace/api-client-react";
import { CoinBadge } from "@/components/coin-badge";
import { NewUserWelcome } from "@/components/new-user-welcome";
import { ProfileAccountProvider, useProfileAccount } from "@/contexts/profile-dialog-context";

type Prefetcher = (qc: ReturnType<typeof useQueryClient>) => void;

const ROUTE_PREFETCH: Record<string, { chunk: () => Promise<unknown>; data: Prefetcher }> = {
  "/": {
    chunk: () => import("@/pages/today"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getListHabitsQueryKey(), queryFn: ({ signal }) => listHabits(undefined, { signal }) });
    },
  },
  "/habits": {
    chunk: () => import("@/pages/habits"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getListHabitsQueryKey(), queryFn: ({ signal }) => listHabits(undefined, { signal }) });
    },
  },
  "/stats": {
    chunk: () => import("@/pages/stats"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getGetDashboardQueryKey(), queryFn: ({ signal }) => getDashboard({ signal }) });
      qc.prefetchQuery({ queryKey: getListHabitsQueryKey(), queryFn: ({ signal }) => listHabits(undefined, { signal }) });
    },
  },
  "/pups": {
    chunk: () => import("@/pages/pups"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getListShopQueryKey(), queryFn: ({ signal }) => listShop({ signal }) });
      qc.prefetchQuery({ queryKey: getGetCollectionQueryKey(), queryFn: ({ signal }) => getCollection({ signal }) });
    },
  },
  "/history": {
    chunk: () => import("@/pages/history"),
    data: (qc) => {
      const now = new Date();
      const params = { year: now.getFullYear(), month: now.getMonth() + 1 };
      qc.prefetchQuery({
        queryKey: getGetHistoryQueryKey(params),
        queryFn: ({ signal }) => getHistory(params, { signal }),
      });
    },
  },
  "/health": {
    chunk: () => import("@/pages/health"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getGetHealthSummaryQueryKey(), queryFn: ({ signal }) => getHealthSummary({ signal }) });
    },
  },
  "/friends": {
    chunk: () => import("@/pages/friends"),
    data: (qc) => {
      qc.prefetchQuery({ queryKey: getGetFriendProfileQueryKey(), queryFn: ({ signal }) => getFriendProfile({ signal }) });
      qc.prefetchQuery({ queryKey: getListFriendRequestsQueryKey(), queryFn: ({ signal }) => listFriendRequests({ signal }) });
      qc.prefetchQuery({ queryKey: getListFriendsQueryKey(), queryFn: ({ signal }) => listFriends({ signal }) });
    },
  },
  "/leaderboard": {
    chunk: () => import("@/pages/leaderboard"),
    data: () => {
      // Leaderboard has dynamic query keys (scope/metric), so no static prefetch.
    },
  },
};

const NAV_ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/habits", label: "Habits", icon: List },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/health", label: "Health", icon: Heart },
  { href: "/pups", label: "Pups", icon: PawPrint },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/premium", label: "Premium", icon: Crown },
] as const;

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Today", icon: Home },
  { href: "/habits", label: "Habits", icon: List },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/health", label: "Health", icon: Heart },
  { href: "/pups", label: "Pups", icon: PawPrint },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileAccountProvider>
      <LayoutShell>{children}</LayoutShell>
    </ProfileAccountProvider>
  );
}

function LayoutShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();
  const { openProfile } = useProfileAccount();

  const prefetch = useCallback(
    (href: string) => {
      const entry = ROUTE_PREFETCH[href];
      if (!entry) return;
      entry.chunk();
      entry.data(queryClient);
    },
    [queryClient],
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background overflow-x-hidden md:h-svh md:max-h-svh md:overflow-hidden">
      <NewUserWelcome />
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between gap-2 p-3 border-b-[3px] border-border bg-accent">
        <div className="flex items-center gap-1.5 text-foreground font-black shrink-0">
          <Star className="w-5 h-5 fill-foreground shrink-0" />
          <span className="text-sm xs:text-base sm:text-2xl tracking-tighter uppercase whitespace-nowrap">HABIGANIZE</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          <CoinBadge compact />
          <button
            type="button"
            onClick={() => openProfile()}
            data-testid="open-profile-mobile"
            aria-label="Profile and account"
            className="p-2 rounded-xl border-brutal-sm bg-white hover:bg-muted active:translate-y-0.5 transition-all"
          >
            <UserRound className="w-4 h-4" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            data-testid="sign-out-mobile"
            aria-label="Sign out"
            className="p-2 rounded-xl border-brutal-sm bg-white hover:bg-muted active:translate-y-0.5 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex w-72 flex-col shrink-0 border-r-[3px] border-border bg-card md:fixed md:top-0 md:left-0 md:z-10 md:h-svh md:max-h-svh md:overflow-y-auto shadow-[4px_0_0_0_hsl(var(--foreground))]">
        <div className="p-6 flex flex-col gap-3 text-foreground font-black bg-accent border-b-[3px] border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Star className="w-7 h-7 fill-foreground shrink-0" />
            <span className="text-2xl tracking-tighter uppercase truncate">HABIGANIZE</span>
          </div>
          <CoinBadge compact />
          <button
            type="button"
            onClick={() => openProfile()}
            data-testid="open-profile-desktop"
            className="mt-3 w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl border-brutal-sm bg-white font-bold text-sm uppercase tracking-wide hover:shadow-brutal-sm hover:bg-muted transition-all"
          >
            <UserRound className="w-5 h-5" strokeWidth={2.5} />
            <span className="tracking-wide">Profile</span>
          </button>
        </div>
        <nav className="flex-1 px-4 space-y-4 mt-6">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="block"
                onPointerEnter={() => prefetch(item.href)}
                onFocus={() => prefetch(item.href)}
                onTouchStart={() => prefetch(item.href)}
              >
                <div
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all cursor-pointer border-brutal-sm font-bold text-base ${
                    isActive
                      ? "bg-primary text-white shadow-brutal-sm translate-x-1"
                      : "bg-card text-foreground hover:bg-muted hover:shadow-brutal-sm"
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={3} />
                  <span className="uppercase tracking-wide">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t-[3px] border-border">
          <button
            type="button"
            onClick={() => signOut()}
            data-testid="sign-out"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-brutal-sm bg-white font-black uppercase tracking-wide text-sm hover:bg-muted hover:shadow-brutal-sm transition-all"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 pb-24 md:pb-0 overflow-x-hidden md:overflow-y-auto md:overscroll-y-contain md:pl-72">
        <div className="flex-1 w-full mx-auto p-2 sm:p-4 md:p-8 lg:p-12 md:max-w-6xl min-w-0 pr-3 sm:pr-4">
          {children}
        </div>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full bg-card border-t-[3px] border-border flex justify-around p-3 pb-safe z-50 shadow-[0_-4px_0_0_hsl(var(--foreground))]">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onPointerEnter={() => prefetch(item.href)}
              onFocus={() => prefetch(item.href)}
              onTouchStart={() => prefetch(item.href)}
            >
              <div
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center gap-1 p-2 px-3 rounded-xl transition-colors cursor-pointer border-2 border-transparent ${
                  isActive ? "bg-primary border-border text-white shadow-[2px_2px_0_0_hsl(var(--foreground))]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 3 : 2} />
                <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
