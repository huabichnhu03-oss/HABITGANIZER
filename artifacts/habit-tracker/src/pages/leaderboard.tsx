import React, { useState } from "react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Medal, Crown, Globe, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";

type Scope = "friends" | "global";
type Metric = "coins" | "completions";

const SCOPE_OPTIONS: { value: Scope; label: string; icon: typeof Globe }[] = [
  { value: "friends", label: "Friends", icon: Users },
  { value: "global", label: "Global", icon: Globe },
];

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: "coins", label: "Coins" },
  { value: "completions", label: "Completions" },
];

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />;
  return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
}

export function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("friends");
  const [metric, setMetric] = useState<Metric>("coins");

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
          title="Couldn't load leaderboard"
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
          <h1 className="text-4xl font-black uppercase tracking-tighter text-foreground">Leaderboard</h1>
          <p className="text-muted-foreground font-medium">See how you stack up</p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Scope toggle */}
        <div className="flex rounded-xl border-2 border-border overflow-hidden shadow-[2px_2px_0_hsl(var(--foreground))]">
          {SCOPE_OPTIONS.map(opt => {
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
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Metric toggle */}
        <div className="flex rounded-xl border-2 border-border overflow-hidden shadow-[2px_2px_0_hsl(var(--foreground))]">
          {METRIC_OPTIONS.map(opt => {
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
                {opt.label}
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
                {scope === "friends"
                  ? "No friends on the leaderboard yet. Add some friends to compete!"
                  : "No entries yet. Be the first!"}
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
                      {entry.displayName || "Unknown"}
                      {entry.isSelf && (
                        <span className="ml-2 text-xs font-bold text-accent uppercase">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">{entry.friendCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-foreground tabular-nums">
                      {entry.score.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                      {metric === "coins" ? "coins" : "done"}
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
