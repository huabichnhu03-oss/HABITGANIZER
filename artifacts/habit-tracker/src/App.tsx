import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, Show, useAuth, useClerk } from "@clerk/react";
import { setAuthTokenGetter, setExtraHeadersGetter } from "@workspace/api-client-react";
import { habitCalendarRequestHeaders } from "@workspace/habit-dates";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { HabitReminderListener } from "@/components/habit-reminder-listener";
import { createClerkAppearance } from "@/lib/clerk-appearance";
import { initializeRewardedAdsWeb } from "@/lib/rewarded-ad-web";

// Resolve publishable key from hostname so the same build can serve multiple
// Clerk custom domains. Falls back to VITE_CLERK_PUBLISHABLE_KEY.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// In prod this is automatically injected; in dev it is empty.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Clerk passes full paths to routerPush/routerReplace; wouter's setLocation
// works relative to the base — strip it to avoid doubling.
function stripBase(p: string): string {
  return basePath && p.startsWith(basePath) ? p.slice(basePath.length) || "/" : p;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = createClerkAppearance(basePath || "/");

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const TodayPage = lazy(() => import("@/pages/today").then(m => ({ default: m.TodayPage })));
const HabitsPage = lazy(() => import("@/pages/habits").then(m => ({ default: m.HabitsPage })));
const StatsPage = lazy(() => import("@/pages/stats").then(m => ({ default: m.StatsPage })));
const HistoryPage = lazy(() => import("@/pages/history").then(m => ({ default: m.HistoryPage })));
const PupsPage = lazy(() => import("@/pages/pups").then(m => ({ default: m.PupsPage })));
const HealthPage = lazy(() => import("@/pages/health").then(m => ({ default: m.HealthPage })));
const FriendsPage = lazy(() => import("@/pages/friends").then(m => ({ default: m.FriendsPage })));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard").then(m => ({ default: m.LeaderboardPage })));
const PremiumPage = lazy(() => import("@/pages/premium"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-foreground border-t-transparent" />
    </div>
  );
}

function LegalFooterLinks() {
  return (
    <p className="mt-8 text-center text-xs text-muted-foreground font-medium">
      <a className="font-bold text-foreground underline" href={`${basePath}/privacy`}>
        Privacy
      </a>
      <span className="mx-2" aria-hidden>
        ·
      </span>
      <a className="font-bold text-foreground underline" href={`${basePath}/support`}>
        Support
      </a>
    </p>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <LegalFooterLinks />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      <LegalFooterLinks />
    </div>
  );
}

// Landing page shown to unauthenticated visitors at the root path.
function WelcomePage() {
  const [, setLocation] = useLocation();
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-background to-accent px-4">
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-56 w-[28rem] max-w-[100vw] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-2xl border-4 border-border bg-card shadow-[6px_6px_0_hsl(var(--foreground))] overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-[hsl(285_62%_68%)] px-6 py-5 flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            ✨
          </span>
          <div>
            <h1 className="font-black text-2xl text-white tracking-tight">HABIGANIZE</h1>
            <p className="text-white/80 text-sm font-medium">Build habits that stick</p>
          </div>
        </div>
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={() => setLocation("/sign-up")}
            className="w-full rounded-xl border-3 border-border bg-primary py-3 font-black uppercase tracking-wider text-white shadow-[3px_3px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
          >
            Get Started
          </button>
          <button
            onClick={() => setLocation("/sign-in")}
            className="w-full rounded-xl border-3 border-border bg-secondary py-3 font-black uppercase tracking-wider text-foreground shadow-[3px_3px_0_hsl(var(--foreground))] active:translate-y-px active:shadow-none transition-all"
          >
            Log In
          </button>
          <p className="text-center text-xs text-muted-foreground font-medium pt-1">
            Your data is saved to your account across all devices.
          </p>
          <LegalFooterLinks />
        </div>
      </div>
    </div>
  );
}

// Attach Clerk session JWT to every `/api` request (same pattern as habit-mobile).
// Cookie-only auth can fail behind Vite’s proxy or with certain Clerk dev setups;
// the bearer token is what @clerk/express resolves reliably.
function ClerkApiSessionTokenBridge() {
  const { getToken } = useAuth();

  useLayoutEffect(() => {
    setAuthTokenGetter(() => getToken());
    setExtraHeadersGetter(() => habitCalendarRequestHeaders());
    return () => {
      setAuthTokenGetter(null);
      setExtraHeadersGetter(null);
    };
  }, [getToken]);

  return null;
}

// Invalidates the React Query cache whenever the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.cancelQueries();
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AppRoutes() {
  return (
    <>
      {/* Signed-in: full app */}
      <Show when="signed-in">
        <HabitReminderListener />
        <Layout>
          <Suspense fallback={<PageFallback />}>
            <Switch>
              <Route path="/" component={TodayPage} />
              <Route path="/habits" component={HabitsPage} />
              <Route path="/stats" component={StatsPage} />
              <Route path="/history" component={HistoryPage} />
              <Route path="/pups" component={PupsPage} />
              <Route path="/health" component={HealthPage} />
              <Route path="/friends" component={FriendsPage} />
              <Route path="/leaderboard" component={LeaderboardPage} />
              <Route path="/premium" component={PremiumPage} />
              <Route path="/sign-in/*?" component={() => <Redirect to="/" />} />
              <Route path="/sign-up/*?" component={() => <Redirect to="/" />} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </Layout>
      </Show>

      {/* Signed-out: landing + auth pages */}
      <Show when="signed-out">
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/" component={WelcomePage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={() => <Redirect to="/" />} />
          </Switch>
        </Suspense>
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    initializeRewardedAdsWeb();
  }, []);

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/`}
      signUpFallbackRedirectUrl={`${basePath}/`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiSessionTokenBridge />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
