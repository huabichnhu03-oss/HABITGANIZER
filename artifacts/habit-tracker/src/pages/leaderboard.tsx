import React, { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Medal, Crown, Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";
import { toIntlLocale, useTranslation } from "@/i18n";

type Scope = "friends" | "global";
type Metric = "coins" | "completions";

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

export function LeaderboardPage() {
  const { t, locale } = useTranslation();
  const [scope, setScope] = useState<Scope>("friends");
  const [metric, setMetric] = useState<Metric>("coins");

  const scopeOptions: { value: Scope; labelKey: string; icon: typeof Globe }[] = [
    { value: "friends", labelKey: "ranks.friends", icon: Users },
    { value: "global", labelKey: "ranks.global", icon: Globe },
  ];

  const metricOptions: { value: Metric; labelKey: string }[] = [
    { value: "coins", labelKey: "ranks.coins" },
    { value: "completions", labelKey: "ranks.completions" },
  ];

  const leaderboardQuery = useGetLeaderboard(
    { scope, metric, limit: 50 },
    {
      query: {
        queryKey: ["leaderboard", scope, metric],
        refetchOnWindowFocus: false,
      },
    }
  );

  if (leaderboardQuery.isError) {
    return (
      <div className="space-y-8">
        <ApiQueryErrorBanner
          title={t("ranks.loadFailed")}
          onRetry={() => void leaderboardQuery.refetch()}
        />
      </div>
    );
  }

  const entries = leaderboardQuery.data?.entries ?? [];
  const isLoading = leaderboardQuery.isLoading;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center gap-4">
        <Trophy className="w-10 h-10 fill-accent text-foreground drop-shadow-[2px_2px_0_rgba(0,0,0,1)] -rotate-6" />
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">{t("ranks.title")}</h1>
          <p className="text-muted-foreground font-medium">{t("ranks.subtitle")}</p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Scope toggle */}
        <div className="flex rounded-xl border-2 border-border overflow-hidden shadow-[2px_2px_0_hsl(var(--foreground))]">
          {scopeOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = scope === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setScope(opt.value)}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-sm transition-all ${
                  isActive
                    ? "bg-primary text-white"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Metric toggle */}
        <div className="flex rounded-xl border-2 border-border overflow-hidden shadow-[2px_2px_0_hsl(var(--foreground))]">
          {metricOptions.map(opt => {
            const isActive = metric === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setMetric(opt.value)}
                className={`px-4 py-2 font-bold text-sm transition-all ${
                  isActive
                    ? "bg-primary text-white"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaderboard Table */}
      <Card className="border-brutal shadow-brutal rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground font-medium">
                {scope === "friends" ? t("ranks.emptyFriends") : t("ranks.emptyGlobal")}
              </p>
            </div>
          ) : (
            <div className="divide-y-2 divide-border">
              {entries.map((entry) => (
                <div
                  key={entry.walletId}
                  className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                    entry.isSelf
                      ? "bg-accent/20 border-l-4 border-l-accent"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="w-8 flex justify-center">
                    {rankIcon(entry.rank)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${entry.isSelf ? "text-foreground" : "text-foreground"}`}>
                      {entry.displayName || t("ranks.unknown")}
                      {entry.isSelf && (
                        <span className="ml-2 text-xs font-bold text-accent uppercase">{t("ranks.you")}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{entry.friendCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-foreground tabular-nums">
                      {entry.score.toLocaleString(toIntlLocale(locale))}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                      {metric === "coins" ? t("ranks.coinsUnit") : t("ranks.doneUnit")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
