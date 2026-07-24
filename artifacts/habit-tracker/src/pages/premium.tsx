import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  PricingTable,
  UserProfile,
  useAuth,
  Show,
  SignInButton,
} from "@clerk/react";
import {
  Crown,
  Zap,
  Star,
  Shield,
  BarChart3,
  Heart,
  Check,
  Sparkles,
  Gift,
  HandHeart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { customFetch, extractApiErrorMessage } from "@workspace/api-client-react";
import { createClerkAppearance } from "@/lib/clerk-appearance";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubscriptionPlan {
  slug: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  maxHabits: number;
  maxPets: number;
  exclusivePets: boolean;
  adFree: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
}

interface CoinPack {
  slug: string;
  name: string;
  description: string;
  coins: number;
  bonusCoins: number;
  totalCoins: number;
  price: number;
  emoji: string;
  popular: boolean;
}

interface UserSubscription {
  plan: string;
  status: string;
  billingCycle?: string;
  currentPeriodEnd?: string;
  features: {
    maxHabits: number;
    maxPets: number;
    exclusivePets: boolean;
    adFree: boolean;
    prioritySupport: boolean;
    advancedAnalytics: boolean;
  };
}

interface DonationPresetResponse {
  currency: string;
  amounts: Array<{ cents: number; label: string }>;
  minCents: number;
  maxCents: number;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkAppearance = createClerkAppearance(basePath || "/");

const DEFAULT_DONATION_AMOUNTS = [
  { cents: 300, label: "$3" },
  { cents: 500, label: "$5" },
  { cents: 1000, label: "$10" },
  { cents: 2500, label: "$25" },
];

async function apiGet<T>(path: string): Promise<T> {
  return customFetch<T>(path, { method: "GET" });
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return customFetch<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export default function PremiumPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { has, isLoaded } = useAuth();
  const [manageOpen, setManageOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState(500);
  const [donateMessage, setDonateMessage] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const clerkPremium =
    isLoaded &&
    Boolean(
      has?.({ plan: "pro" }) ||
        has?.({ plan: "premium" }) ||
        has?.({ plan: "ultimate" }),
    );

  const { data: plans = [] } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: () => apiGet<SubscriptionPlan[]>("/api/plans"),
  });

  const { data: coinPacks = [] } = useQuery({
    queryKey: ["/api/coin-packs"],
    queryFn: () => apiGet<CoinPack[]>("/api/coin-packs"),
  });

  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription"],
    queryFn: () => apiGet<UserSubscription>("/api/subscription"),
  });

  const { data: donationPresets } = useQuery({
    queryKey: ["/api/donations/presets"],
    queryFn: () => apiGet<DonationPresetResponse>("/api/donations/presets"),
  });

  const buyCoinsMutation = useMutation({
    mutationFn: async (packSlug: string) =>
      apiPost<{ url: string }>(`/api/coin-packs/checkout/${packSlug}`),
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
        description: extractApiErrorMessage(error, error.message),
        variant: "destructive",
      });
    },
  });

  const donateMutation = useMutation({
    mutationFn: async () =>
      apiPost<{ url: string }>("/api/donations/checkout", {
        amountCents: donateAmount,
        message: donateMessage.trim() || undefined,
      }),
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
    },
    onError: (error: Error) => {
      toast({
        title: "Donation failed",
        description: extractApiErrorMessage(error, error.message),
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("donated") === "1") {
      toast({
        title: "Thank you! 💛",
        description: "Your donation helps keep Habiganize growing.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/donations/mine"] });
    }
    if (params.get("coins") === "1") {
      toast({
        title: "Coins on the way!",
        description: "Payment received. Your wallet will update in a moment.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
    }
  }, [toast, queryClient]);

  const isPremium =
    clerkPremium || (subscription?.plan !== "free" && subscription?.status === "active");

  const planIcons: Record<string, React.ReactNode> = {
    free: <Heart className="h-6 w-6" />,
    pro: <Zap className="h-6 w-6" />,
    premium: <Crown className="h-6 w-6" />,
    ultimate: <Sparkles className="h-6 w-6" />,
  };

  const planColors: Record<string, string> = {
    free: "from-stone-500 to-stone-600",
    pro: "from-sky-500 to-cyan-600",
    premium: "from-rose-500 to-pink-600",
    ultimate: "from-amber-500 to-orange-600",
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-black mb-4 tracking-tight text-foreground">
          Supercharge Your Habits
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Unlock premium features, exclusive pets, and support Habiganize
        </p>
      </motion.div>

      <Tabs defaultValue="plans" className="space-y-8">
        <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
          <TabsTrigger value="plans" className="gap-2">
            <Crown className="h-4 w-4" /> Plans
          </TabsTrigger>
          <TabsTrigger value="coins" className="gap-2">
            <Gift className="h-4 w-4" /> Coins
          </TabsTrigger>
          <TabsTrigger value="donate" className="gap-2">
            <HandHeart className="h-4 w-4" /> Donate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-8">
          <Show when="signed-out">
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground">Sign in to subscribe to a plan.</p>
                <SignInButton mode="modal">
                  <Button>Sign in</Button>
                </SignInButton>
              </CardContent>
            </Card>
          </Show>

          <Show when="signed-in">
            <div className="rounded-2xl border-4 border-foreground bg-card p-4 md:p-6 shadow-[6px_6px_0_hsl(var(--foreground))]">
              <PricingTable
                for="user"
                appearance={clerkAppearance}
                newSubscriptionRedirectUrl={`${basePath}/premium`}
              />
            </div>
          </Show>

          {plans.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-center">What each tier unlocks in Habiganize</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan, index) => (
                  <motion.div
                    key={plan.slug}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={cn(
                        "h-full border-2",
                        subscription?.plan === plan.slug && "border-green-600",
                      )}
                    >
                      <CardHeader className="pb-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-2",
                            planColors[plan.slug],
                          )}
                        >
                          {planIcons[plan.slug]}
                        </div>
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            {plan.maxHabits === -1 ? "Unlimited" : plan.maxHabits} habits
                          </li>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-green-600" />
                            {plan.maxPets === -1 ? "Unlimited" : plan.maxPets} pets
                          </li>
                          {plan.exclusivePets && (
                            <li className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-amber-500" /> Exclusive pets
                            </li>
                          )}
                          {plan.adFree && (
                            <li className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-sky-500" /> Ad-free
                            </li>
                          )}
                          {plan.advancedAnalytics && (
                            <li className="flex items-center gap-2">
                              <BarChart3 className="h-4 w-4 text-rose-500" /> Analytics
                            </li>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {isPremium && subscription && (
            <Card className="bg-gradient-to-r from-rose-500/10 to-amber-500/10 border-2 border-foreground">
              <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">Your plan: {subscription.plan}</h3>
                  <p className="text-muted-foreground text-sm">
                    {subscription.billingCycle === "yearly" ? "Annual" : "Monthly"}
                    {subscription.currentPeriodEnd
                      ? ` · Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setManageOpen(true)}>
                  Manage subscription
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="coins">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {coinPacks.map((pack, index) => (
              <motion.div
                key={pack.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className={cn(
                    "relative overflow-hidden h-full border-2",
                    pack.popular && "border-amber-500 shadow-[4px_4px_0_#f59e0b]",
                  )}
                >
                  {pack.popular && (
                    <Badge className="absolute top-2 right-2 bg-amber-500">Best value</Badge>
                  )}
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="text-4xl">{pack.emoji}</div>
                    <h3 className="font-semibold text-lg">{pack.name}</h3>
                    <p className="text-sm text-muted-foreground">{pack.description}</p>
                    <div className="text-3xl font-bold text-amber-700">
                      {pack.coins.toLocaleString()}
                    </div>
                    {pack.bonusCoins > 0 && (
                      <div className="text-sm text-green-700 font-medium">
                        +{pack.bonusCoins.toLocaleString()} bonus
                      </div>
                    )}
                    <div className="text-2xl font-bold">${(pack.price / 100).toFixed(2)}</div>
                    <Show when="signed-in">
                      <Button
                        className="w-full"
                        variant={pack.popular ? "default" : "outline"}
                        disabled={buyCoinsMutation.isPending}
                        onClick={() => buyCoinsMutation.mutate(pack.slug)}
                      >
                        {buyCoinsMutation.isPending ? "Redirecting…" : "Buy with Stripe"}
                      </Button>
                    </Show>
                    <Show when="signed-out">
                      <SignInButton mode="modal">
                        <Button className="w-full" variant="outline">
                          Sign in to buy
                        </Button>
                      </SignInButton>
                    </Show>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="donate">
          <Card className="max-w-xl mx-auto border-4 border-foreground shadow-[6px_6px_0_hsl(var(--foreground))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HandHeart className="h-5 w-5 text-rose-500" /> Support Habiganize
              </CardTitle>
              <CardDescription>
                One-time donation via Stripe. 100% goes to keeping the pups fed (and the servers
                online).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {(donationPresets?.amounts ?? DEFAULT_DONATION_AMOUNTS).map((a) => (
                  <Button
                    key={a.cents}
                    type="button"
                    variant={donateAmount === a.cents ? "default" : "outline"}
                    onClick={() => {
                      setDonateAmount(a.cents);
                      setCustomAmount("");
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wide" htmlFor="custom-donate">
                  Custom amount (USD)
                </label>
                <Input
                  id="custom-donate"
                  inputMode="decimal"
                  placeholder="e.g. 7.50"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    const dollars = Number(e.target.value);
                    if (Number.isFinite(dollars) && dollars > 0) {
                      setDonateAmount(Math.round(dollars * 100));
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wide" htmlFor="donate-msg">
                  Optional note
                </label>
                <Textarea
                  id="donate-msg"
                  rows={3}
                  maxLength={280}
                  placeholder="Say hi to the pups…"
                  value={donateMessage}
                  onChange={(e) => setDonateMessage(e.target.value)}
                />
              </div>

              <Show when="signed-in">
                <Button
                  className="w-full"
                  size="lg"
                  disabled={donateMutation.isPending || donateAmount < 100}
                  onClick={() => donateMutation.mutate()}
                >
                  {donateMutation.isPending
                    ? "Redirecting…"
                    : `Donate $${(donateAmount / 100).toFixed(2)}`}
                </Button>
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button className="w-full" size="lg" variant="outline">
                    Sign in to donate
                  </Button>
                </SignInButton>
              </Show>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Billing & account</DialogTitle>
          </DialogHeader>
          <UserProfile appearance={clerkAppearance} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
