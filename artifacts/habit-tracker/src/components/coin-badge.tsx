import React from "react";
import { useGetWallet } from "@workspace/api-client-react";
import { Coins, Drumstick, Droplet } from "lucide-react";

export function CoinBadge({ compact = false }: { compact?: boolean }) {
  const { data } = useGetWallet();
  const coins = data?.coins ?? 0;
  const food = data?.food ?? 0;
  const water = data?.water ?? 0;
  const sizing = compact ? "px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-xs sm:text-sm" : "px-3 py-1.5 text-base";
  return (
    <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
      <div
        data-testid="coin-balance"
        className={`flex items-center gap-1 bg-yellow-300 border-brutal-sm shadow-brutal-sm rounded-xl font-black ${sizing}`}
      >
        <Coins className="w-4 h-4 fill-yellow-500 text-foreground" strokeWidth={3} />
        <span>{coins}</span>
      </div>
      <div
        data-testid="food-balance"
        className={`flex items-center gap-1 bg-pink-300 border-brutal-sm shadow-brutal-sm rounded-xl font-black ${sizing}`}
        title="Food"
      >
        <Drumstick className="w-4 h-4 text-foreground" strokeWidth={3} />
        <span>{food}</span>
      </div>
      <div
        data-testid="water-balance"
        className={`flex items-center gap-1 bg-blue-200 border-brutal-sm shadow-brutal-sm rounded-xl font-black ${sizing}`}
        title="Water"
      >
        <Droplet className="w-4 h-4 fill-blue-500 text-foreground" strokeWidth={3} />
        <span>{water}</span>
      </div>
    </div>
  );
}
