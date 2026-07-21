import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Zap, Star, Shield, BarChart3, Heart, Check, X, Sparkles, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

export default function PremiumPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscription plans
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/plans"],
  });

  // Fetch coin packs
  const { data: coinPacks = [] } = useQuery<CoinPack[]>({
    queryKey: ["/api/coin-packs"],
  });

  // Fetch current subscription
  const { data: subscription } = useQuery<UserSubscription>({
    queryKey: ["/api/subscription"],
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async ({ planSlug, cycle }: { planSlug: string; cycle: string }) => {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, billingCycle: cycle }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to subscribe");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Welcome to Premium! 🎉",
        description: "Your subscription is now active. Enjoy all the perks!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Subscription failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Buy coins mutation
  const buyCoinsMutation = useMutation({
    mutationFn: async (packSlug: string) => {
      const res = await fetch(`/api/coin-packs/buy/${packSlug}`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to purchase coins");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
      toast({
        title: "Coins purchased! ✨",
        description: `${data.coinsAwarded} coins added to your wallet!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isPremium = subscription?.plan !== "free" && subscription?.status === "active";

  const planIcons: Record<string, React.ReactNode> = {
    free: <Heart className="h-6 w-6" />,
    pro: <Zap className="h-6 w-6" />,
    premium: <Crown className="h-6 w-6" />,
    ultimate: <Sparkles className="h-6 w-6" />,
  };

  const planColors: Record<string, string> = {
    free: "from-gray-500 to-gray-600",
    pro: "from-blue-500 to-purple-600",
    premium: "from-purple-500 to-pink-600",
    ultimate: "from-amber-500 to-orange-600",
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Supercharge Your Habits
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Unlock premium features, exclusive pets, and unlimited habit tracking
        </p>
      </motion.div>

      <Tabs defaultValue="plans" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="plans" className="gap-2">
            <Crown className="h-4 w-4" /> Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="coins" className="gap-2">
            <Gift className="h-4 w-4" /> Buy Coins
          </TabsTrigger>
        </TabsList>

        {/* Subscription Plans Tab */}
        <TabsContent value="plans">
          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingCycle === "monthly"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                  billingCycle === "yearly"
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                Yearly
                <Badge variant="secondary" className="ml-2">
                  Save 20%
                </Badge>
              </button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={cn(
                    "relative overflow-hidden h-full",
                    plan.slug === "premium" && "border-purple-500 shadow-lg shadow-purple-500/20",
                    subscription?.plan === plan.slug && "border-green-500"
                  )}
                >
                  {plan.slug === "premium" && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-purple-500 to-pink-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                      Most Popular
                    </div>
                  )}
                  {subscription?.plan === plan.slug && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                      Current Plan
                    </div>
                  )}

                  <CardHeader>
                    <div
                      className={cn(
                        "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center text-white mb-4",
                        planColors[plan.slug]
                      )}
                    >
                      {planIcons[plan.slug]}
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Price */}
                    <div>
                      <div className="text-3xl font-bold">
                        ${billingCycle === "monthly"
                          ? (plan.priceMonthly / 100).toFixed(2)
                          : (plan.priceYearly / 100).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        per {billingCycle === "monthly" ? "month" : "year"}
                      </div>
                      {billingCycle === "yearly" && plan.priceMonthly > 0 && (
                        <div className="text-sm text-green-600 mt-1">
                          Save ${((plan.priceMonthly * 12 - plan.priceYearly) / 100).toFixed(2)}/year
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul className="space-y-3">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>
                          {plan.maxHabits === -1 ? "Unlimited" : plan.maxHabits} habits
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>
                          {plan.maxPets === -1 ? "Unlimited" : plan.maxPets} pets
                        </span>
                      </li>
                      {plan.exclusivePets && (
                        <li className="flex items-center gap-2 text-sm">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span>Exclusive pets</span>
                        </li>
                      )}
                      {plan.adFree && (
                        <li className="flex items-center gap-2 text-sm">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span>Ad-free experience</span>
                        </li>
                      )}
                      {plan.advancedAnalytics && (
                        <li className="flex items-center gap-2 text-sm">
                          <BarChart3 className="h-4 w-4 text-purple-500" />
                          <span>Advanced analytics</span>
                        </li>
                      )}
                      {plan.prioritySupport && (
                        <li className="flex items-center gap-2 text-sm">
                          <Zap className="h-4 w-4 text-orange-500" />
                          <span>Priority support</span>
                        </li>
                      )}
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <Button
                      className="w-full"
                      variant={plan.slug === "premium" ? "default" : "outline"}
                      disabled={
                        subscription?.plan === plan.slug ||
                        subscribeMutation.isPending
                      }
                      onClick={() =>
                        subscribeMutation.mutate({
                          planSlug: plan.slug,
                          cycle: billingCycle,
                        })
                      }
                    >
                      {subscription?.plan === plan.slug
                        ? "Current Plan"
                        : subscribeMutation.isPending
                        ? "Processing..."
                        : plan.slug === "free"
                        ? "Free Forever"
                        : "Subscribe Now"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Current Subscription Info */}
          {isPremium && subscription && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">Your Premium Subscription</h3>
                      <p className="text-muted-foreground">
                        {subscription.billingCycle === "yearly" ? "Annual" : "Monthly"} plan •
                        Renews{" "}
                        {subscription.currentPeriodEnd
                          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Manage Subscription
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* Coin Packs Tab */}
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
                    "relative overflow-hidden h-full",
                    pack.popular && "border-amber-500 shadow-lg shadow-amber-500/20"
                  )}
                >
                  {pack.popular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-orange-500 text-white px-3 py-1 text-xs font-medium rounded-bl-lg">
                      Best Value
                    </div>
                  )}

                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-4">{pack.emoji}</div>
                    <h3 className="font-semibold text-lg mb-2">{pack.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{pack.description}</p>

                    <div className="space-y-2 mb-6">
                      <div className="text-3xl font-bold text-amber-600">
                        {pack.coins.toLocaleString()}
                      </div>
                      {pack.bonusCoins > 0 && (
                        <div className="text-sm text-green-600 font-medium">
                          + {pack.bonusCoins.toLocaleString()} bonus!
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Total: {pack.totalCoins.toLocaleString()} coins
                      </div>
                    </div>

                    <div className="text-2xl font-bold mb-4">
                      ${(pack.price / 100).toFixed(2)}
                    </div>

                    <Button
                      className="w-full"
                      variant={pack.popular ? "default" : "outline"}
                      disabled={buyCoinsMutation.isPending}
                      onClick={() => buyCoinsMutation.mutate(pack.slug)}
                    >
                      {buyCoinsMutation.isPending ? "Processing..." : "Buy Now"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">What can I do with coins?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🐾</div>
                    <div>
                      <h4 className="font-medium">Adopt Pets</h4>
                      <p className="text-sm text-muted-foreground">
                        Unlock adorable virtual companions to care for
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🍖</div>
                    <div>
                      <h4 className="font-medium">Buy Food & Toys</h4>
                      <p className="text-sm text-muted-foreground">
                        Keep your pets happy and healthy
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🎓</div>
                    <div>
                      <h4 className="font-medium">Train Tricks</h4>
                      <p className="text-sm text-muted-foreground">
                        Teach your pets new tricks and level them up
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
