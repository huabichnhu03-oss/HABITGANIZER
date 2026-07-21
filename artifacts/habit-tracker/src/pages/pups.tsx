import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useListShop,
  useGetCollection,
  useGetWallet,
  useBuyPet,
  useFeedPet,
  useWaterPet,
  useWalkPet,
  useBathPet,
  usePlayPet,
  useRenamePet,
  useSetPetAccessoryLayout,
  useListFoods,
  useBuyFood,
  useFeedPetWith,
  useListToys,
  useBuyToy,
  usePlayPetWith,
  useTrainPet,
  useGetVisitor,
  usePlayWithVisitor,
  useWatchAdForCoins,
  useWatchAdVisitorSpeedup,
  getListShopQueryKey,
  getGetCollectionQueryKey,
  getGetWalletQueryKey,
  getListFoodsQueryKey,
  getListToysQueryKey,
  getGetVisitorQueryKey,
  formatPetCareErrorMessage,
  optimisticallyRenamePetInCollectionCache,
  patchOwnedPetInCollectionCache,
} from "@workspace/api-client-react";
import type { OwnedPet, PetAccessoryPlacement, Wallet, PetFood, PetToy } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Lock, Sparkles, X, Drumstick, Droplet, Trash2, Footprints, Bath, Gamepad2, Pencil, Check, GraduationCap, PartyPopper } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatWaitRemaining, formatWaitRemainingA11y } from "@/lib/format-wait-label";
import { PixelPup } from "@/components/PixelPup";
import { PixelAccessory } from "@/components/PixelAccessory";
import { ApiQueryErrorBanner } from "@/components/api-query-error-banner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  isRewardedAdReadyWeb,
  preloadRewardedAdWeb,
  showRewardedAdWeb,
} from "@/lib/rewarded-ad-web";

type Placement = PetAccessoryPlacement;

type AccessoryCategory = "head" | "eyes" | "neck" | "extras";

const ACCESSORIES: {
  id: string;
  label: string;
  category: AccessoryCategory;
  defaultX: number;
  defaultY: number;
}[] = [
  { id: "crown",     label: "Crown",     category: "head",   defaultX: 0.5,  defaultY: 0.12 },
  { id: "hat",       label: "Top hat",   category: "head",   defaultX: 0.5,  defaultY: 0.12 },
  { id: "cap",       label: "Cap",       category: "head",   defaultX: 0.5,  defaultY: 0.14 },
  { id: "graduate",  label: "Grad cap",  category: "head",   defaultX: 0.5,  defaultY: 0.12 },
  { id: "glasses",   label: "Shades",    category: "eyes",   defaultX: 0.5,  defaultY: 0.38 },
  { id: "specs",     label: "Glasses",   category: "eyes",   defaultX: 0.5,  defaultY: 0.38 },
  { id: "goggles",   label: "Goggles",   category: "eyes",   defaultX: 0.5,  defaultY: 0.38 },
  { id: "bowtie",    label: "Bowtie",    category: "neck",   defaultX: 0.5,  defaultY: 0.62 },
  { id: "scarf",     label: "Scarf",     category: "neck",   defaultX: 0.5,  defaultY: 0.66 },
  { id: "necktie",   label: "Necktie",   category: "neck",   defaultX: 0.5,  defaultY: 0.66 },
  { id: "bell",      label: "Bell",      category: "neck",   defaultX: 0.5,  defaultY: 0.62 },
  { id: "bone",      label: "Bone",      category: "extras", defaultX: 0.5,  defaultY: 0.52 },
  { id: "flower",    label: "Flower",    category: "extras", defaultX: 0.28, defaultY: 0.22 },
  { id: "star",      label: "Star",      category: "extras", defaultX: 0.74, defaultY: 0.32 },
  { id: "beanie",    label: "Beanie",    category: "head",   defaultX: 0.5,  defaultY: 0.12 },
  { id: "party",     label: "Party hat", category: "head",   defaultX: 0.5,  defaultY: 0.10 },
  { id: "halo",      label: "Halo",      category: "head",   defaultX: 0.5,  defaultY: 0.08 },
  { id: "santa",     label: "Santa hat", category: "head",   defaultX: 0.5,  defaultY: 0.10 },
  { id: "monocle",   label: "Monocle",   category: "eyes",   defaultX: 0.62, defaultY: 0.38 },
  { id: "heart-eye", label: "Hearts",    category: "eyes",   defaultX: 0.5,  defaultY: 0.36 },
  { id: "collar",    label: "Collar",    category: "neck",   defaultX: 0.5,  defaultY: 0.66 },
  { id: "medal",     label: "Medal",     category: "neck",   defaultX: 0.5,  defaultY: 0.70 },
  { id: "pawprint",  label: "Paw",       category: "extras", defaultX: 0.30, defaultY: 0.78 },
  { id: "fire",      label: "Fire",      category: "extras", defaultX: 0.80, defaultY: 0.78 },
  { id: "rainbow",   label: "Rainbow",   category: "extras", defaultX: 0.18, defaultY: 0.30 },
  { id: "ball-toy",  label: "Ball",      category: "extras", defaultX: 0.85, defaultY: 0.85 },
];

const CATEGORY_ORDER: AccessoryCategory[] = ["head", "eyes", "neck", "extras"];
const CATEGORY_LABELS: Record<AccessoryCategory, string> = {
  head: "Head",
  eyes: "Eyes",
  neck: "Neck",
  extras: "Extras",
};

const MOOD_EMOJI: Record<OwnedPet["mood"], string> = {
  happy: "😄",
  content: "🙂",
  hungry: "🍗",
  thirsty: "💧",
  sad: "😢",
};

const COINS_SHORTAGE_TITLE = "Not enough coins";
const COINS_SHORTAGE_DESCRIPTION =
  "You don't have enough coins yet. Complete habits and track more tasks to earn more.";

const WATCH_AD_PATRON_COPY =
  "Habiganize is non-profit. Watching a short ad is like buying our team a coffee at the café — thank you for helping keep the app free.";

/** Optional layered bath sprites under public/pups-art/bath/ — mirror on API static host for native clients. */
const BATH_BACKGROUND_SRC = "/pups-art/bath/background.png";
const BATH_SHOWER_HEAD_SRC = "/pups-art/bath/shower-head.png";
const COINS_TOAST_MS = 5000;
const SUCCESS_TOAST_MS = 4000;
const REWARD_POP_MS = 3000;

type ShopCategory = "pets" | "food" | "toys";

const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: "pets", label: "Pups" },
  { id: "food", label: "Food" },
  { id: "toys", label: "Toys" },
];

function getErrorString(err: unknown): string {
  if (typeof err !== "object" || err === null) return "";
  const e = err as Record<string, unknown>;
  const response = e.response && typeof e.response === "object" ? (e.response as Record<string, unknown>) : null;
  const responseData = response?.data && typeof response.data === "object" ? (response.data as Record<string, unknown>) : null;
  const dataObj = e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>) : null;
  const body = (responseData?.error ?? dataObj?.error ?? "") as string;
  const msg = (typeof e.message === "string" ? e.message : "") as string;
  return body || msg;
}

function isInsufficientCoinsError(err: unknown): boolean {
  const text = getErrorString(err);
  return /need\s+\d+\s+more\s+coins?/i.test(text);
}

export function PupsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    void preloadRewardedAdWeb();
  }, []);
  const shopQuery = useListShop();
  const collectionQuery = useGetCollection();
  const walletQuery = useGetWallet();
  const { data: shop } = shopQuery;
  const { data: collection } = collectionQuery;
  const { data: wallet } = walletQuery;
  const buyPet = useBuyPet();
  const [tab, setTab] = useState<"shop" | "collection">("shop");
  const [shopCategory, setShopCategory] = useState<ShopCategory>("pets");
  const [openPetId, setOpenPetId] = useState<number | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: getListShopQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCollectionQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getListFoodsQueryKey() });
    qc.invalidateQueries({ queryKey: getListToysQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVisitorQueryKey() });
  };

  const handleBuy = (slug: string, name: string) => {
    buyPet.mutate(
      { slug },
      {
        onSuccess: () => {
          toast({
            title: `${name} is yours!`,
            description: "Check your collection.",
            variant: "success",
            duration: SUCCESS_TOAST_MS,
          });
          invalidateAll();
          setTab("collection");
        },
        onError: (err) => {
          if (isInsufficientCoinsError(err)) {
            toast({
              title: COINS_SHORTAGE_TITLE,
              description: COINS_SHORTAGE_DESCRIPTION,
              variant: "accent",
              duration: COINS_TOAST_MS,
            });
          } else {
            toast({
              title: "Oops",
              description: errorMessage(err, "Could not buy pet"),
              variant: "destructive",
              duration: COINS_TOAST_MS,
            });
          }
        },
      }
    );
  };

  const openPet = useMemo(
    () => collection?.find((p) => p.id === openPetId) ?? null,
    [collection, openPetId]
  );

  useEffect(() => {
    if (openPetId !== null && collection && !collection.some((p) => p.id === openPetId)) {
      setOpenPetId(null);
    }
  }, [collection, openPetId]);

  if (shopQuery.isError || collectionQuery.isError || walletQuery.isError) {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden pb-4 pr-4 sm:pb-5 sm:pr-5">
        <ApiQueryErrorBanner
          title="Couldn’t load Pups"
          onRetry={() => {
            void shopQuery.refetch();
            void collectionQuery.refetch();
            void walletQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-x-hidden pb-4 pr-4 sm:pb-5 sm:pr-5">
      <header className="bg-primary text-white p-4 sm:p-6 rounded-3xl border-brutal shadow-brutal">
        <div className="flex items-center gap-2 sm:gap-3">
          <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" strokeWidth={3} />
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">Pups</h1>
        </div>
        <p className="font-bold text-sm sm:text-lg mt-2 opacity-90">
          Earn coins, food, and water by completing habits. Spend coins on dogs, then keep them fed and styled.
        </p>
      </header>

      <VisitorCard onChanged={invalidateAll} />

      <WatchAdForCoinsRow onChanged={invalidateAll} />

      <div className="flex gap-2 sm:gap-3">
        <button
          data-testid="tab-shop"
          onClick={() => setTab("shop")}
          className={cn(
            "flex-1 py-3 sm:py-4 rounded-2xl border-brutal font-black uppercase text-sm sm:text-lg tracking-wider transition-all",
            tab === "shop"
              ? "bg-accent text-foreground shadow-brutal"
              : "bg-card text-foreground shadow-brutal-sm hover:translate-y-0.5"
          )}
        >
          Shop
        </button>
        <button
          data-testid="tab-collection"
          onClick={() => setTab("collection")}
          className={cn(
            "flex-1 py-3 sm:py-4 rounded-2xl border-brutal font-black uppercase text-sm sm:text-lg tracking-wider transition-all",
            tab === "collection"
              ? "bg-accent text-foreground shadow-brutal"
              : "bg-card text-foreground shadow-brutal-sm hover:translate-y-0.5"
          )}
        >
          Collection ({collection?.length ?? 0})
        </button>
      </div>

      {tab === "shop" && (
        <div className="rounded-3xl border-[3px] border-foreground bg-card shadow-brutal overflow-hidden">
          <div
            role="tablist"
            aria-label="Shop categories"
            className="flex flex-wrap items-end gap-x-1 gap-y-1 sm:gap-x-2 bg-muted/90 px-1 sm:px-2 pt-2 sm:pt-2.5"
          >
            {SHOP_CATEGORIES.map(({ id, label }) => {
              const active = shopCategory === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  id={`shop-tab-${id}`}
                  aria-controls={`shop-panel-${id}`}
                  data-testid={`shop-section-${id}`}
                  onClick={() => setShopCategory(id)}
                  className={cn(
                    "relative min-w-[4.5rem] sm:min-w-[6rem] px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-t-2xl border-[3px] border-b-0 border-foreground font-black uppercase text-[10px] sm:text-sm tracking-wider transition-all",
                    active
                      ? "z-20 bg-card pb-3 -mb-[3px] text-foreground"
                      : "z-10 bg-muted/90 text-foreground/70 hover:text-foreground hover:bg-muted mb-0"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div
            role="tabpanel"
            id={`shop-panel-${shopCategory}`}
            aria-labelledby={`shop-tab-${shopCategory}`}
            className="relative z-[15] min-h-[14rem] overflow-hidden border-t-[3px] border-foreground bg-card p-4 sm:p-6"
          >
            {shopCategory === "pets" && (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
                {!shop && [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-72 bg-muted border-brutal shadow-brutal rounded-3xl animate-pulse" />
                ))}
                {shop?.map((pet) => (
                  <div
                    key={pet.slug}
                    data-testid={`shop-pet-${pet.slug}`}
                    className="bg-card border-brutal shadow-brutal rounded-3xl overflow-hidden flex flex-col"
                  >
                    <div className="aspect-square flex items-center justify-center p-3 border-b-[3px] border-foreground">
                      <PixelPup slug={pet.slug} size={120} />
                    </div>
                    <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2">
                      <div className="flex flex-col gap-0.5 min-[390px]:flex-row min-[390px]:items-baseline min-[390px]:justify-between">
                        <h3 className="text-lg min-[390px]:text-xl sm:text-2xl font-black uppercase tracking-tight leading-tight">
                          {pet.name}
                        </h3>
                        <span className="text-[10px] sm:text-xs font-bold uppercase opacity-70">{pet.breed}</span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-foreground/80 flex-1 leading-snug line-clamp-3 sm:line-clamp-none">
                        {pet.description}
                      </p>
                      {pet.owned ? (
                        <div className="mt-2 py-3 rounded-xl bg-muted border-brutal-sm font-black uppercase text-center text-foreground/70 flex items-center justify-center gap-2">
                          <Lock className="w-4 h-4" strokeWidth={3} /> Owned
                        </div>
                      ) : (
                        <button
                          data-testid={`buy-${pet.slug}`}
                          onClick={() => handleBuy(pet.slug, pet.name)}
                          disabled={buyPet.isPending}
                          className="mt-2 py-3 rounded-xl bg-accent border-brutal-sm shadow-brutal-sm font-black uppercase flex items-center justify-center gap-2 hover:translate-y-0.5 hover:shadow-none active:translate-y-1 transition-all disabled:opacity-60"
                        >
                          <Coins className="w-5 h-5 fill-yellow-400" strokeWidth={3} />
                          {pet.price}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {shopCategory === "food" && <FoodShop onChanged={invalidateAll} />}
            {shopCategory === "toys" && <ToyShop onChanged={invalidateAll} />}
          </div>
        </div>
      )}

      {tab === "collection" && (
        <div>
          {!collection ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2].map((i) => (
                <div key={i} className="h-72 bg-muted border-brutal shadow-brutal rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : collection.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {collection.map((pet) => (
                <button
                  key={pet.id}
                  data-testid={`owned-pet-${pet.slug}`}
                  onClick={() => setOpenPetId(pet.id)}
                  className="text-left bg-card border-brutal shadow-brutal rounded-3xl overflow-hidden flex flex-col hover:translate-y-0.5 hover:shadow-brutal-sm transition-all"
                >
                  <div className="aspect-square flex items-center justify-center p-3 border-b-[3px] border-foreground relative">
                    <PixelPup slug={pet.slug} size={120} />
                    {pet.accessoryLayout.map((p, i) => (
                      <div
                        key={i}
                        className="absolute pointer-events-none drop-shadow-[2px_2px_0_rgba(0,0,0,1)] flex items-center justify-center"
                        style={{
                          left: `${p.x * 100}%`,
                          top: `${p.y * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <PixelAccessory id={p.accessoryId} size={56} />
                      </div>
                    ))}
                    <span className="absolute top-2 right-2 text-3xl">{MOOD_EMOJI[pet.mood]}</span>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-accent border-brutal-sm font-black text-xs">
                      LV {pet.level}
                    </span>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-2xl font-black uppercase tracking-tight">{pet.name}</h3>
                      <span className="text-xs font-bold uppercase opacity-70">{pet.breed}</span>
                    </div>
                    <Meter label="Hunger" icon={<Drumstick className="w-3.5 h-3.5" strokeWidth={3} />} value={pet.hunger} color="bg-pink-400" />
                    <Meter label="Thirst" icon={<Droplet className="w-3.5 h-3.5 fill-blue-500" strokeWidth={3} />} value={pet.thirst} color="bg-blue-400" />
                    <p className="mt-1 text-xs font-bold uppercase opacity-70 text-center">Tap to care &amp; dress up</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-3xl border-brutal shadow-brutal">
              <span className="text-7xl block mb-4">🐶</span>
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tight">No Pups Yet</h2>
              <p className="text-lg font-bold">Complete habits to earn coins, then visit the shop!</p>
            </div>
          )}
        </div>
      )}

      {openPet && (
        <PetDetailModal
          pet={openPet}
          wallet={wallet}
          onClose={() => setOpenPetId(null)}
          onChanged={invalidateAll}
        />
      )}
    </div>
  );
}

function Meter({
  label,
  icon,
  value,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-black uppercase mb-1">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span>{pct}</span>
      </div>
      <div className="h-3 rounded-full bg-muted border-brutal-sm overflow-hidden">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}


function CareMeter({
  label,
  icon,
  value,
  status,
  color,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  status: string;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div data-testid={`meter-${label.toLowerCase()}`} className="p-2 rounded-xl bg-muted border-brutal-sm">
      <div className="flex items-center justify-between text-[11px] font-black uppercase mb-1">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span>{pct}</span>
      </div>
      <div className="h-2 rounded-full bg-card border border-foreground/20 overflow-hidden mb-1">
        <div className={cn("h-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[9px] font-bold uppercase opacity-70 truncate" title={status}>
        {status}
      </div>
    </div>
  );
}

function ActionButton({
  testId,
  icon,
  label,
  tone,
  disabled,
  hint,
  onClick,
}: {
  testId: string;
  icon: React.ReactNode;
  label: string;
  tone: string;
  disabled: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className={cn(
        "py-3 px-2 rounded-xl border-brutal-sm shadow-brutal-sm font-black uppercase flex flex-col items-center justify-center gap-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-y-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none",
        tone
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      {disabled && hint && (
        <span className="text-[9px] font-bold opacity-80 truncate max-w-full">{hint}</span>
      )}
    </button>
  );
}

type DragState =
  | { kind: "tray"; accessoryId: string; pointerId: number; x: number; y: number; offsetX: number; offsetY: number }
  | { kind: "placed"; index: number; pointerId: number; x: number; y: number; offsetX: number; offsetY: number }
  | null;

function errorMessage(err: unknown, fallback: string): string {
  const text = getErrorString(err);
  return text || fallback;
}

function PetDetailModal({
  pet,
  wallet,
  onClose,
  onChanged,
}: {
  pet: OwnedPet;
  wallet: Wallet | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const feedPet = useFeedPet();
  const waterPet = useWaterPet();
  const walkPet = useWalkPet();
  const bathPet = useBathPet();
  const playPet = usePlayPet();
  const setLayout = useSetPetAccessoryLayout();
  const renamePet = useRenamePet();
  const trainPet = useTrainPet();
  const [walkOpen, setWalkOpen] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(pet.name);
  const [dressUp, setDressUp] = useState(false);
  const [trayCategory, setTrayCategory] = useState<AccessoryCategory | "all">("all");
  useEffect(() => {
    if (!editingName) setNameDraft(pet.name);
  }, [pet.name, editingName]);
  const submitName = () => {
    const trimmed = nameDraft.trim().slice(0, 30);
    if (trimmed.length === 0) {
      toast({ title: "Name can't be empty", variant: "destructive" });
      setNameDraft(pet.name);
      setEditingName(false);
      return;
    }
    if (trimmed === pet.name) {
      setEditingName(false);
      return;
    }
    void (async () => {
      await qc.cancelQueries({ queryKey: getGetCollectionQueryKey() });
      const previous = optimisticallyRenamePetInCollectionCache(qc, pet.id, trimmed);
      try {
        const updated = await renamePet.mutateAsync({ id: pet.id, data: { name: trimmed } });
        setEditingName(false);
        patchOwnedPetInCollectionCache(qc, updated);
        onChanged();
      } catch (err) {
        if (previous) qc.setQueryData(getGetCollectionQueryKey(), previous);
        toast({ title: "Couldn't rename", description: errorMessage(err, "Try again"), variant: "destructive" });
        setNameDraft(pet.name);
        setEditingName(false);
      }
    })();
  };
  const careBusy = renamePet.isPending;
  const [reward, setReward] = useState<{ id: number; label: string; color: string } | null>(null);
  const popReward = (label: string, color: string) => {
    const id = Date.now();
    setReward({ id, label, color });
    setTimeout(() => setReward((r) => (r?.id === id ? null : r)), REWARD_POP_MS);
  };

  const [layout, setLocalLayout] = useState<Placement[]>(() => pet.accessoryLayout);
  const [drag, setDrag] = useState<DragState>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!drag) setLocalLayout(pet.accessoryLayout);
  }, [pet.accessoryLayout, drag]);

  const persistLayout = (next: Placement[]) => {
    setLayout.mutate(
      { id: pet.id, data: { accessoryLayout: next } },
      {
        onSuccess: () => onChanged(),
        onError: (err) => {
          toast({
            title: "Couldn't save outfit",
            description: errorMessage(err, "Try again"),
            variant: "destructive",
          });
          setLocalLayout(pet.accessoryLayout);
        },
      }
    );
  };

  const handleFeed = () => {
    feedPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => {
          popReward("+35 🍗", "bg-pink-300");
          onChanged();
        },
        onError: (err) =>
          toast({
            title: "Can't feed",
            description: formatPetCareErrorMessage(err, pet.name, "No food left — complete a habit!"),
            variant: "destructive",
          }),
      }
    );
  };

  const handlePlay = () => {
    playPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => {
          popReward("+100 🎾", "bg-violet-300");
          onChanged();
        },
        onError: (err) =>
          toast({
            title: "Play on cooldown",
            description: errorMessage(err, "Try again later"),
            variant: "destructive",
          }),
      }
    );
  };

  const handleWalkComplete = () => {
    walkPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => {
          popReward("+100 🐾", "bg-emerald-300");
          onChanged();
          setWalkOpen(false);
        },
        onError: (err) => {
          toast({
            title: "Walk on cooldown",
            description: errorMessage(err, "Try again later"),
            variant: "destructive",
          });
          setWalkOpen(false);
        },
      }
    );
  };

  const handleBathComplete = () => {
    bathPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => {
          popReward("+100 🛁", "bg-cyan-300");
          onChanged();
          setBathOpen(false);
        },
        onError: (err) => {
          toast({
            title: "Bath on cooldown",
            description: errorMessage(err, "Try again later"),
            variant: "destructive",
          });
          setBathOpen(false);
        },
      }
    );
  };

  const normalize = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  };

  const onTrayPointerDown = (e: React.PointerEvent, accessoryId: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      kind: "tray",
      accessoryId,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offsetX: 0,
      offsetY: 0,
    });
  };

  const onPlacedPointerDown = (e: React.PointerEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    setDrag({
      kind: "placed",
      index,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - centerX,
      offsetY: e.clientY - centerY,
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
    if (drag.kind === "placed") {
      const norm = normalize(e.clientX - drag.offsetX, e.clientY - drag.offsetY);
      if (norm) {
        setLocalLayout((prev) => {
          const copy = [...prev];
          if (copy[drag.index]) copy[drag.index] = { ...copy[drag.index], x: norm.x, y: norm.y };
          return copy;
        });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const anchorX = e.clientX - drag.offsetX;
    const anchorY = e.clientY - drag.offsetY;
    const norm = normalize(anchorX, anchorY);
    const rect = canvasRef.current?.getBoundingClientRect();
    const inside =
      !!rect &&
      anchorX >= rect.left &&
      anchorX <= rect.right &&
      anchorY >= rect.top &&
      anchorY <= rect.bottom;
    if (drag.kind === "tray") {
      const fallback = ACCESSORIES.find((a) => a.id === drag.accessoryId);
      const placeAt =
        norm && inside
          ? norm
          : fallback
            ? { x: fallback.defaultX, y: fallback.defaultY }
            : { x: 0.5, y: 0.5 };
      setLocalLayout((prev) => {
        const next = [...prev, { accessoryId: drag.accessoryId, x: placeAt.x, y: placeAt.y }];
        persistLayout(next);
        return next;
      });
    } else if (drag.kind === "placed") {
      setLocalLayout((prev) => {
        let next: Placement[];
        if (!inside) {
          next = prev.filter((_, i) => i !== drag.index);
        } else if (norm) {
          next = prev.map((p, i) => (i === drag.index ? { ...p, x: norm.x, y: norm.y } : p));
        } else {
          next = prev;
        }
        persistLayout(next);
        return next;
      });
    }
    setDrag(null);
  };

  const removeAt = (index: number) => {
    setLocalLayout((prev) => {
      const next = prev.filter((_, i) => i !== index);
      persistLayout(next);
      return next;
    });
  };

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-40 bg-foreground/60 flex flex-col items-center justify-center p-2 sm:p-4 min-h-0 overflow-hidden",
        "max-md:bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:bottom-0 animate-in fade-in"
      )}
      onClick={onClose}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={cn(
          "relative bg-card border-brutal shadow-brutal rounded-3xl w-full max-w-lg flex flex-col min-h-0 max-h-full md:max-h-[min(95vh,100dvh-2rem)] overflow-hidden",
          drag && "touch-none"
        )}
        onClick={(e) => e.stopPropagation()}
        data-testid="pet-detail-modal"
      >
        <div className="flex shrink-0 items-center justify-between p-4 border-b-[3px] border-foreground bg-card z-10">
          <div className="min-w-0 flex-1 mr-2">
            {editingName ? (
              <form
                onSubmit={(e) => { e.preventDefault(); submitName(); }}
                className="flex items-center gap-2"
              >
                <input
                  data-testid="pet-name-input"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={submitName}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { setNameDraft(pet.name); setEditingName(false); }
                  }}
                  maxLength={30}
                  className="text-2xl font-black uppercase tracking-tight bg-card border-brutal-sm rounded-md px-2 py-0.5 w-full min-w-0"
                />
                <button
                  type="submit"
                  data-testid="pet-name-save"
                  className="p-1.5 rounded-lg border-brutal-sm bg-emerald-300"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Check className="w-4 h-4" strokeWidth={3} />
                </button>
              </form>
            ) : (
              <button
                data-testid="pet-name-edit"
                onClick={() => { setNameDraft(pet.name); setEditingName(true); }}
                className="group flex items-center gap-2 text-left"
                title="Click to rename"
              >
                <h2 className="text-2xl font-black uppercase tracking-tight truncate">{pet.name}</h2>
                <Pencil className="w-4 h-4 opacity-50 group-hover:opacity-100" strokeWidth={3} />
              </button>
            )}
            <p className="text-xs font-bold uppercase opacity-70">
              {pet.breed} · LV {pet.level} · {pet.mood}
            </p>
          </div>
          <button
            data-testid="close-pet-detail"
            aria-label="Close pet details"
            onClick={onClose}
            className="p-2 rounded-xl border-brutal-sm bg-card hover:bg-destructive/20"
          >
            <X className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>

        <div
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
            drag && "overflow-hidden touch-none"
          )}
        >
          <div className="p-4 pb-8 space-y-4 md:pb-4">
          <div
            ref={canvasRef}
            data-testid="pet-canvas"
            className="relative aspect-square bg-secondary border-brutal-sm rounded-2xl overflow-hidden touch-none select-none"
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
              <PixelPup slug={pet.slug} size={200} />
            </div>
            {reward && (
              <div
                key={reward.id}
                data-testid="reward-pop"
                className={cn(
                  "absolute left-1/2 top-6 -translate-x-1/2 px-3 py-1.5 rounded-xl border-brutal-sm font-black text-lg pointer-events-none animate-in fade-in slide-in-from-top-2",
                  reward.color
                )}
              >
                {reward.label}
              </div>
            )}
            {layout.map((p, i) => (
              <button
                key={i}
                data-testid={`placed-${i}`}
                onPointerDown={(e) => onPlacedPointerDown(e, i)}
                onDoubleClick={() => removeAt(i)}
                className="absolute cursor-grab active:cursor-grabbing drop-shadow-[2px_2px_0_rgba(0,0,0,1)] flex items-center justify-center p-1"
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  touchAction: "none",
                }}
                title="Drag to reposition · Double-click to remove"
              >
                <PixelAccessory id={p.accessoryId} size={64} />
              </button>
            ))}
            <span className="absolute top-3 right-3 text-4xl pointer-events-none">{MOOD_EMOJI[pet.mood]}</span>
            {drag && (
              <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] font-black uppercase opacity-60">
                Drop outside to remove
              </div>
            )}
          </div>

          <button
            data-testid="toggle-dressup"
            onClick={() => setDressUp((v) => !v)}
            className={cn(
              "w-full py-2.5 rounded-xl border-brutal-sm font-black uppercase text-sm flex items-center justify-center gap-2 transition-colors",
              dressUp ? "bg-fuchsia-300 shadow-brutal-sm" : "bg-card hover:bg-muted"
            )}
          >
            <Sparkles className="w-4 h-4" strokeWidth={3} />
            {dressUp ? "Exit dress-up" : "Dress-up mode"}
          </button>

          {!dressUp && (<>
          <div className="grid grid-cols-2 gap-2">
            <CareMeter label="Walk" icon={<Footprints className="w-3.5 h-3.5" strokeWidth={3} />} value={pet.walk} status={pet.walkLabel} color="bg-emerald-400" />
            <CareMeter label="Bath" icon={<Bath className="w-3.5 h-3.5" strokeWidth={3} />} value={pet.bath} status={pet.bathLabel} color="bg-cyan-400" />
            <CareMeter label="Feed" icon={<Drumstick className="w-3.5 h-3.5" strokeWidth={3} />} value={pet.hunger} status={pet.feedLabel} color="bg-pink-400" />
            <CareMeter label="Play" icon={<Gamepad2 className="w-3.5 h-3.5" strokeWidth={3} />} value={pet.play} status={pet.playLabel} color="bg-violet-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ActionButton
              testId={`walk-${pet.id}`}
              icon={<Footprints className="w-5 h-5" strokeWidth={3} />}
              label="Walk"
              tone="bg-emerald-300"
              disabled={careBusy || walkPet.isPending || !pet.walkReady}
              hint={pet.walkReady ? "Take for a walk" : pet.walkLabel}
              onClick={() => setWalkOpen(true)}
            />
            <ActionButton
              testId={`bath-${pet.id}`}
              icon={<Bath className="w-5 h-5" strokeWidth={3} />}
              label="Bath"
              tone="bg-cyan-300"
              disabled={careBusy || bathPet.isPending || !pet.bathReady}
              hint={pet.bathReady ? "Give a bath" : pet.bathLabel}
              onClick={() => setBathOpen(true)}
            />
            <ActionButton
              testId={`feed-${pet.id}`}
              icon={<Drumstick className="w-5 h-5" strokeWidth={3} />}
              label="Feed"
              tone="bg-pink-300"
              disabled={careBusy || feedPet.isPending || !pet.feedReady}
              hint={pet.feedLabel}
              onClick={handleFeed}
            />
            <ActionButton
              testId={`play-${pet.id}`}
              icon={<Gamepad2 className="w-5 h-5" strokeWidth={3} />}
              label="Play"
              tone="bg-violet-300"
              disabled={careBusy || playPet.isPending || !pet.playReady}
              hint={pet.playReady ? "Play together" : pet.playLabel}
              onClick={handlePlay}
            />
          </div>

          <button
            data-testid={`train-${pet.id}`}
            onClick={() =>
              trainPet.mutate(
                { id: pet.id },
                {
                  onSuccess: (res) => {
                    popReward(res.leveledUp ? `LV UP! → ${res.pet.level}` : `+1 trick`, "bg-amber-300");
                    onChanged();
                  },
                  onError: (err) =>
                    toast({
                      title: "Can't train",
                      description: errorMessage(err, "Try again later"),
                      variant: "destructive",
                    }),
                }
              )
            }
            disabled={careBusy || trainPet.isPending || pet.level >= 10}
            className="w-full py-3 rounded-xl bg-amber-300 border-brutal-sm shadow-brutal-sm font-black uppercase text-sm flex items-center justify-center gap-2 hover:translate-y-0.5 hover:shadow-none active:translate-y-1 transition-all disabled:opacity-60"
          >
            <GraduationCap className="w-5 h-5" strokeWidth={3} />
            Train · 5 <Coins className="w-4 h-4 fill-yellow-400" strokeWidth={3} />
            {pet.level >= 10 ? " · MAX" : ""}
          </button>

          {(wallet?.water ?? 0) > 0 && (
            <button
              data-testid={`water-${pet.id}`}
              onClick={() => waterPet.mutate({ id: pet.id }, {
                onSuccess: () => { popReward("+35 💧", "bg-blue-300"); onChanged(); },
                onError: (err) => toast({
                  title: "Can't water",
                  description: formatPetCareErrorMessage(err, pet.name, "Try again"),
                  variant: "destructive",
                }),
              })}
              disabled={careBusy || waterPet.isPending || pet.thirst >= 100}
              className="w-full py-2 rounded-xl bg-blue-200 border-brutal-sm font-black uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Droplet className="w-4 h-4 fill-blue-500" strokeWidth={3} />
              Water · {pet.thirst}% · {wallet?.water ?? 0} left
            </button>
          )}
          </>)}

          {dressUp && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Accessory tray</span>
              <span className="text-[10px] opacity-70">Tap to wear</span>
            </h3>
            {dressUp && (
              <div className="flex flex-wrap gap-2 mb-2" data-testid="tray-category-tabs">
                {(["all", ...CATEGORY_ORDER] as const).map((cat) => (
                  <button
                    key={cat}
                    data-testid={`tray-cat-${cat}`}
                    onClick={() => setTrayCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded-full border-brutal-sm font-black uppercase text-[10px] tracking-wider",
                      trayCategory === cat ? "bg-accent shadow-brutal-sm" : "bg-card hover:bg-muted"
                    )}
                  >
                    {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            )}
            <div
              data-testid="accessory-tray"
              className="space-y-2.5 p-3 rounded-2xl bg-muted border-brutal-sm"
            >
              {CATEGORY_ORDER.filter((cat) => !dressUp || trayCategory === "all" || trayCategory === cat).map((cat) => {
                const items = ACCESSORIES.filter((a) => a.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat}>
                    <div className="text-[10px] font-black uppercase opacity-60 mb-1.5 tracking-widest">
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div className={cn("grid gap-2", dressUp ? "grid-cols-4" : "grid-cols-5") }>
                      {items.map((a) => {
                        const wornCount = layout.filter((p) => p.accessoryId === a.id).length;
                        return (
                          <button
                            key={a.id}
                            data-testid={`tray-${a.id}`}
                            onPointerDown={(e) => onTrayPointerDown(e, a.id)}
                            className={cn(
                              "relative aspect-square rounded-lg border-brutal-sm text-3xl flex items-center justify-center cursor-grab active:cursor-grabbing select-none",
                              wornCount > 0 ? "bg-fuchsia-200" : "bg-card",
                              dressUp && "p-1.5"
                            )}
                            style={{ touchAction: "none" }}
                            title={dressUp ? `Tap to wear ${a.label}` : `Drag ${a.label}`}
                          >
                            <PixelAccessory id={a.id} size={dressUp ? 44 : 40} />
                            {wornCount > 0 && (
                              <span className="absolute -top-1 -right-1 text-[10px] font-black bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center border-2 border-background">
                                {wornCount}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {layout.length > 0 && (
              <button
                data-testid="clear-layout"
                onClick={() => {
                  setLocalLayout([]);
                  persistLayout([]);
                }}
                className="mt-3 w-full py-2 rounded-xl bg-card border-brutal-sm font-black uppercase text-sm flex items-center justify-center gap-2 hover:bg-destructive/20"
              >
                <Trash2 className="w-4 h-4" strokeWidth={3} />
                Clear all
              </button>
            )}
          </div>
          )}
          </div>
        </div>

        {drag?.kind === "tray" && (
          <span
            className="fixed pointer-events-none z-50 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] flex justify-center items-center"
            style={{
              left: drag.x,
              top: drag.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <PixelAccessory id={drag.accessoryId} size={64} />
          </span>
        )}
        {walkOpen && (
          <WalkActivity
            petSlug={pet.slug}
            onClose={() => setWalkOpen(false)}
            onComplete={handleWalkComplete}
          />
        )}
        {bathOpen && (
          <BathActivity
            petSlug={pet.slug}
            onClose={() => setBathOpen(false)}
            onComplete={handleBathComplete}
          />
        )}
      </div>
    </div>
  );
}

type WatchAdPhase = "intro" | "watch" | "grant";

function WatchAdSupportDialog({
  open,
  onOpenChange,
  headline,
  rewardLine,
  grantRef,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  headline: string;
  rewardLine: string;
  grantRef: React.MutableRefObject<() => Promise<void>>;
}) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<WatchAdPhase>("intro");
  const [rewardedReady, setRewardedReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase("intro");
      setRewardedReady(false);
      return;
    }
    setRewardedReady(isRewardedAdReadyWeb());
    void preloadRewardedAdWeb().then((ok) => setRewardedReady(ok || isRewardedAdReadyWeb()));
  }, [open]);

  useEffect(() => {
    if (phase !== "watch" || !open) return;
    let cancelled = false;
    void (async () => {
      const result = await showRewardedAdWeb();
      if (cancelled) return;
      if (result === "earned") {
        setPhase("grant");
        return;
      }
      onOpenChange(false);
      setPhase("intro");
      if (result === "dismissed") {
        toast({
          title: "Ad skipped",
          description: "Watch the full sponsor message to earn your reward.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Ad unavailable",
          description: "Couldn't load a sponsor message right now. Try again in a bit.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, open, onOpenChange, toast]);

  useEffect(() => {
    if (phase !== "grant" || !open) return;
    let cancelled = false;
    void (async () => {
      try {
        await grantRef.current();
      } finally {
        if (!cancelled) {
          onOpenChange(false);
          setPhase("intro");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, open, grantRef, onOpenChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onOpenChange(false);
      }}
    >
      <DialogContent className="max-w-md border-brutal shadow-brutal rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-black uppercase text-lg tracking-tight">{headline}</DialogTitle>
          <DialogDescription className="text-sm font-semibold text-foreground/85 pt-1 leading-snug">
            {WATCH_AD_PATRON_COPY}
          </DialogDescription>
        </DialogHeader>
        {phase === "intro" && (
          <>
            <p className="text-sm font-bold text-foreground/80 leading-snug">{rewardLine}</p>
            <p className="text-[11px] font-semibold text-foreground/70">
              {rewardedReady ? "Rewarded video is ready." : "Preparing rewarded video…"}
            </p>
          </>
        )}
        {phase === "watch" && (
          <div className="rounded-xl border-brutal-sm bg-muted p-4 text-center text-sm font-black">
            {rewardedReady ? "Opening rewarded video…" : "Loading rewarded ad…"}
          </div>
        )}
        {phase === "grant" && (
          <div className="rounded-xl border-brutal-sm bg-accent/50 p-4 text-center text-sm font-black">Claiming reward…</div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          {phase === "intro" ? (
            <button
              type="button"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-accent border-brutal-sm shadow-brutal-sm font-black uppercase text-sm"
              onClick={() => {
                setRewardedReady(isRewardedAdReadyWeb());
                setPhase("watch");
              }}
            >
              Watch rewarded ad
            </button>
          ) : (
            <span className="text-xs font-bold text-muted-foreground px-1">Please keep this open for a moment.</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WatchAdForCoinsRow({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const grantRef = useRef(() => Promise.resolve());
  const watchCoins = useWatchAdForCoins();
  grantRef.current = async () => {
    try {
      const res = await watchCoins.mutateAsync();
      onChanged();
      toast({
        title: "Bonus coins!",
        description: `+${res.coinsAwarded} coins — thank you for supporting Habiganize.`,
        variant: "success",
        duration: SUCCESS_TOAST_MS,
      });
    } catch (err) {
      toast({
        title: "Couldn’t claim reward",
        description: errorMessage(err, "Try again later."),
        variant: "destructive",
        duration: COINS_TOAST_MS,
      });
    }
  };
  return (
    <>
      <WatchAdSupportDialog
        open={open}
        onOpenChange={setOpen}
        headline="Earn bonus coins"
        rewardLine="A short rewarded video adds bonus coins when you finish it."
        grantRef={grantRef}
      />
      <div className="rounded-2xl border-brutal shadow-brutal-sm bg-amber-100 p-3 sm:p-4">
        <p className="text-[11px] sm:text-xs font-bold text-foreground/85 leading-snug mb-3">{WATCH_AD_PATRON_COPY}</p>
        <button
          type="button"
          data-testid="watch-ad-coins-btn"
          disabled={watchCoins.isPending}
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-yellow-300 border-brutal-sm shadow-brutal-sm font-black uppercase text-xs sm:text-sm disabled:opacity-60"
        >
          Watch ad · bonus coins
        </button>
      </div>
    </>
  );
}

function VisitorCard({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const { data: visitor } = (useGetVisitor as any)({
    query: {
      refetchInterval: (q: any) => (q.state.data?.ready === false ? 10_000 : false),
    },
  });
  const playVisitor = usePlayWithVisitor();
  const watchSpeedup = useWatchAdVisitorSpeedup();
  const [adOpen, setAdOpen] = useState(false);
  const grantSpeedRef = useRef(() => Promise.resolve());
  const [reward, setReward] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const tickMs = visitor?.ready === true ? 30_000 : 1_000;
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  grantSpeedRef.current = async () => {
    try {
      const res = await watchSpeedup.mutateAsync();
      onChanged();
      const desc =
        res.secondsSkipped >= 120
          ? `About ${Math.round(res.secondsSkipped / 60)} minutes closer to the next pup.`
          : "The next visitor is almost here.";
      toast({
        title: "Wait shortened",
        description: `${desc} Thanks for supporting our non-profit.`,
        variant: "success",
        duration: SUCCESS_TOAST_MS,
      });
    } catch (err) {
      toast({
        title: "Speed-up unavailable",
        description: errorMessage(err, "Try again later."),
        variant: "destructive",
      });
    }
  };

  if (!visitor) return null;
  const cooldownMs = new Date(visitor.availableAt).getTime() - now;
  const ready = visitor.ready;
  const showPet = Boolean(ready && visitor.slug && visitor.name);
  return (
    <>
      <WatchAdSupportDialog
        open={adOpen}
        onOpenChange={setAdOpen}
        headline="Speed up playdate wait"
        rewardLine="A short rewarded video shaves time off the wait for your next visitor."
        grantRef={grantSpeedRef}
      />
      <div
        data-testid="visitor-card"
        className="rounded-3xl bg-fuchsia-200 border-brutal shadow-brutal p-3 sm:p-5 flex items-center gap-3 sm:gap-4"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl border-brutal-sm flex items-center justify-center overflow-hidden shrink-0">
          {visitor.slug ? (
            <PixelPup slug={visitor.slug} size={72} walking={false} />
          ) : (
            <PartyPopper className="w-10 h-10" strokeWidth={3} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase opacity-70">
            {showPet ? "Today's playdate visitor" : "Today's playdate"}
          </div>
          <div className="text-lg font-black truncate">{showPet ? visitor.name : "Next pup on the way"}</div>
          <div className="text-xs opacity-70 truncate">{showPet ? visitor.breed : ""}</div>
          {!ready && (
            <p className="text-[10px] sm:text-[11px] font-bold mt-1.5 leading-snug opacity-80">
              Watch a short ad to skip part of this wait — it helps our non-profit, like buying the team a coffee at the café.
            </p>
          )}
          {reward && <div className="text-xs font-black mt-1">{reward}</div>}
        </div>
        <div className="flex flex-col gap-2 shrink-0 items-stretch sm:items-end">
          <button
            data-testid="visitor-play-btn"
            type="button"
            onClick={() =>
              playVisitor.mutate(undefined, {
                onSuccess: (res) => {
                  setReward(`+${res.coinsAwarded} coins!`);
                  setTimeout(() => setReward(null), 4000);
                  onChanged();
                },
                onError: (err) =>
                  toast({
                    title: "Visit on cooldown",
                    description: errorMessage(err, "Come back later"),
                    variant: "destructive",
                  }),
              })
            }
            disabled={!ready || playVisitor.isPending}
            aria-label={
              ready ? "Play with today’s visitor and earn fifteen coins" : formatWaitRemainingA11y(cooldownMs)
            }
            className={`px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-accent border-brutal-sm shadow-brutal-sm font-black disabled:opacity-60 whitespace-nowrap tabular-nums tracking-tight ${
              ready ? "text-xs sm:text-sm uppercase" : "text-[11px] sm:text-[13px] normal-case font-bold text-center min-w-[4.75rem]"
            }`}
          >
            {ready ? "Play · +15 🪙" : formatWaitRemaining(cooldownMs)}
          </button>
          {!ready && (
            <button
              type="button"
              data-testid="visitor-watch-ad-speed-btn"
              onClick={() => setAdOpen(true)}
              disabled={watchSpeedup.isPending}
              className="px-2 sm:px-3 py-1.5 rounded-lg bg-white/90 border-brutal-sm shadow-brutal-sm font-black uppercase text-[10px] sm:text-[11px] text-foreground disabled:opacity-60"
            >
              Ad · speed up
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function FoodShop({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const { data: foods, isLoading } = useListFoods();
  const buyFood = useBuyFood();
  if (isLoading) {
    return (
      <div data-testid="food-shop" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-muted border-brutal-sm shadow-brutal-sm animate-pulse" />
        ))}
      </div>
    );
  }
  if (!foods || foods.length === 0) {
    return (
      <div data-testid="food-shop" className="py-12 text-center rounded-2xl border-brutal-sm bg-muted/40">
        <p className="text-lg font-black uppercase opacity-80">No foods in the shop</p>
        <p className="mt-2 text-sm font-bold opacity-60">Check back later for new treats.</p>
      </div>
    );
  }
  return (
    <section data-testid="food-shop" className="space-y-3">
      <h2 className="text-2xl font-black uppercase">🍽️ Premium Foods</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {foods.map((food: PetFood) => (
          <div
            key={food.slug}
            data-testid={`food-${food.slug}`}
            className="rounded-2xl bg-card border-brutal-sm shadow-brutal-sm p-4 space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl">{food.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-black truncate">{food.name}</div>
                <div className="text-[10px] opacity-70">+{food.hungerAmount} hunger · +{food.bonusLevel} level boost</div>
              </div>
            </div>
            <div className="text-xs opacity-80">{food.description}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Owned: {food.owned}</span>
              <button
                data-testid={`buy-food-${food.slug}`}
                onClick={() =>
                  buyFood.mutate(
                    { slug: food.slug },
                    {
                      onSuccess: () => onChanged(),
                      onError: (err) =>
                        toast(
                          isInsufficientCoinsError(err)
                            ? {
                                title: COINS_SHORTAGE_TITLE,
                                description: COINS_SHORTAGE_DESCRIPTION,
                                variant: "accent",
                                duration: COINS_TOAST_MS,
                              }
                            : {
                                title: "Can't buy",
                                description: errorMessage(err, "Try again later"),
                                variant: "destructive",
                                duration: COINS_TOAST_MS,
                              }
                        ),
                    }
                  )
                }
                disabled={buyFood.isPending}
                className="px-3 py-1.5 rounded-lg bg-accent border-brutal-sm font-black text-xs uppercase flex items-center gap-1 disabled:opacity-60"
              >
                <Coins className="w-3.5 h-3.5 fill-yellow-400" strokeWidth={3} /> {food.price}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ToyShop({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const { data: toys, isLoading } = useListToys();
  const buyToy = useBuyToy();
  if (isLoading) {
    return (
      <div data-testid="toy-shop" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 rounded-2xl bg-muted border-brutal-sm shadow-brutal-sm animate-pulse" />
        ))}
      </div>
    );
  }
  if (!toys || toys.length === 0) {
    return (
      <div data-testid="toy-shop" className="py-12 text-center rounded-2xl border-brutal-sm bg-muted/40">
        <p className="text-lg font-black uppercase opacity-80">No toys in the shop</p>
        <p className="mt-2 text-sm font-bold opacity-60">Check back later for new toys.</p>
      </div>
    );
  }
  return (
    <section data-testid="toy-shop" className="space-y-3">
      <h2 className="text-2xl font-black uppercase">🎾 Toys</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {toys.map((toy: PetToy) => (
          <div
            key={toy.slug}
            data-testid={`toy-${toy.slug}`}
            className="rounded-2xl bg-card border-brutal-sm shadow-brutal-sm p-4 space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className="text-4xl">{toy.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="font-black truncate">{toy.name}</div>
                <div className="text-[10px] opacity-70 leading-snug">
                  +{toy.happinessGain} happier · wait {toy.cooldownMinutes} minutes between plays
                </div>
              </div>
            </div>
            <div className="text-xs opacity-80">{toy.description}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{toy.owned ? "OWNED" : "Locked"}</span>
              {!toy.owned && (
                <button
                  data-testid={`buy-toy-${toy.slug}`}
                  onClick={() =>
                    buyToy.mutate(
                      { slug: toy.slug },
                      {
                        onSuccess: () => onChanged(),
                        onError: (err) =>
                          toast(
                            isInsufficientCoinsError(err)
                              ? {
                                  title: COINS_SHORTAGE_TITLE,
                                  description: COINS_SHORTAGE_DESCRIPTION,
                                  variant: "accent",
                                  duration: COINS_TOAST_MS,
                                }
                              : {
                                  title: "Can't buy",
                                  description: errorMessage(err, "Try again later"),
                                  variant: "destructive",
                                  duration: COINS_TOAST_MS,
                                }
                          ),
                      }
                    )
                  }
                  disabled={buyToy.isPending}
                  className="px-3 py-1.5 rounded-lg bg-accent border-brutal-sm font-black text-xs uppercase flex items-center gap-1 disabled:opacity-60"
                >
                  <Coins className="w-3.5 h-3.5 fill-yellow-400" strokeWidth={3} /> {toy.price}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Normalized wash target over the layered bath stage — drag shower tip through here */
const BATH_WASH_ZONE = { l: 0.22, r: 0.78, t: 0.3, b: 0.74 };
/** Nozzle spray origin offset from draggable handle centre (hose points toward the pup). */
const BATH_NOZZLE_OFFSET = { x: -0.07, y: -0.1 };

function BathBubbleField({ washProgress }: { washProgress: number }) {
  const foam = Math.max(0, 1 - washProgress / 100);
  const bubbles = [
    { l: "14%", t: "38%", s: 12, delay: "0ms" },
    { l: "28%", t: "48%", s: 10, delay: "120ms" },
    { l: "42%", t: "36%", s: 14, delay: "60ms" },
    { l: "56%", t: "52%", s: 11, delay: "200ms" },
    { l: "68%", t: "40%", s: 13, delay: "90ms" },
    { l: "36%", t: "62%", s: 9, delay: "150ms" },
    { l: "50%", t: "58%", s: 10, delay: "30ms" },
    { l: "62%", t: "30%", s: 12, delay: "180ms" },
  ];
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      style={{ opacity: 0.2 + foam * 0.72 }}
    >
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/90 border-2 border-foreground/20 shadow-sm"
          style={{
            width: b.s,
            height: b.s,
            left: b.l,
            top: b.t,
            transform: "translate(-50%, -50%)",
            animation: `bath-bobble 2.2s ease-in-out ${b.delay} infinite`,
          }}
        />
      ))}
      <style>{`@keyframes bath-bobble { 0%,100% { transform: translate(-50%, -50%) scale(1)} 50% { transform: translate(-50%, calc(-50% - 4px)) scale(1.05)} }`}</style>
      {foam > 0.05 ? (
        <div
          className="absolute inset-0 rounded-2xl mix-blend-multiply bg-amber-900/35 pointer-events-none"
          style={{ opacity: foam * 0.55 }}
        />
      ) : null}
    </div>
  );
}

function BathActivity({
  petSlug,
  onClose,
  onComplete,
}: {
  petSlug: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hideBgImg, setHideBgImg] = useState(false);
  const [hideShowerImg, setHideShowerImg] = useState(false);
  const [hoseNorm, setHoseNorm] = useState({ nx: 0.78, ny: 0.72 });
  const hoseNormRef = useRef(hoseNorm);
  useEffect(() => {
    hoseNormRef.current = hoseNorm;
  }, [hoseNorm]);
  const [washProgress, setWashProgress] = useState(0);
  const washRef = useRef(0);
  const doneSentRef = useRef(false);
  const finishRef = useRef(onComplete);
  useEffect(() => {
    finishRef.current = onComplete;
  }, [onComplete]);

  const bumpFinish = useCallback(() => {
    if (doneSentRef.current) return;
    doneSentRef.current = true;
    window.setTimeout(() => {
      finishRef.current();
    }, 140);
  }, []);

  useEffect(() => {
    washRef.current = washProgress;
  }, [washProgress]);

  useEffect(() => {
    let rafId = 0;
    let last = performance.now();
    const zone = BATH_WASH_ZONE;
    const off = BATH_NOZZLE_OFFSET;

    const tick = (now: number) => {
      if (doneSentRef.current) return;
      const dt = Math.min(48, Math.max(0, now - last));
      last = now;
      const h = hoseNormRef.current;
      const tipX = h.nx + off.x;
      const tipY = h.ny + off.y;
      const rinsing = tipX >= zone.l && tipX <= zone.r && tipY >= zone.t && tipY <= zone.b;

      let next = washRef.current;
      if (rinsing) next = Math.min(100, next + dt * 0.072);

      if (next !== washRef.current) {
        washRef.current = next;
        setWashProgress(next);
      }

      if (next >= 100) {
        bumpFinish();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [bumpFinish]);

  const draggingRef = useRef<{ pointerId: number; startClientX: number; startClientY: number; startNx: number; startNy: number } | null>(null);

  const clampNorm = (nx: number, ny: number) => ({
    nx: Math.max(0.12, Math.min(0.88, nx)),
    ny: Math.max(0.14, Math.min(0.86, ny)),
  });

  const onHosePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startNx: hoseNormRef.current.nx,
      startNy: hoseNormRef.current.ny,
    };
  };

  const onHosePointerMove = (e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 1 || rect.height < 1) return;
    const dx = (e.clientX - d.startClientX) / rect.width;
    const dy = (e.clientY - d.startClientY) / rect.height;
    const next = clampNorm(d.startNx + dx, d.startNy + dy);
    setHoseNorm(next);
  };

  const onHosePointerUp = (e: React.PointerEvent) => {
    if (draggingRef.current?.pointerId === e.pointerId) draggingRef.current = null;
  };

  const h = hoseNorm;
  const tipX = h.nx + BATH_NOZZLE_OFFSET.x;
  const tipY = h.ny + BATH_NOZZLE_OFFSET.y;
  const rinsingNow =
    tipX >= BATH_WASH_ZONE.l &&
    tipX <= BATH_WASH_ZONE.r &&
    tipY >= BATH_WASH_ZONE.t &&
    tipY <= BATH_WASH_ZONE.b;

  const scrubHint =
    washProgress >= 100 ? "All clean!" : rinsingNow ? `${Math.floor(washProgress)}% rinsed` : "Drag shower into dashed zone";

  const stagePct = rinsingNow && washProgress < 99 ? `${((tipX + tipY) / 2) * 40 + 180}deg` : "200deg";

  return (
    <div
      data-testid="bath-overlay"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/95 p-4"
    >
      <button
        onClick={onClose}
        data-testid="bath-cancel"
        aria-label="Cancel bath"
        className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-card border-brutal-sm shadow-brutal-sm flex items-center justify-center z-50"
      >
        <X className="w-5 h-5" strokeWidth={3} />
      </button>
      <div className="text-center mb-3">
        <h3 className="text-2xl font-black uppercase">Scrub time!</h3>
        <p className="text-xs font-bold uppercase opacity-70 mt-1 max-w-[300px] mx-auto leading-snug">
          Drag the shower through the dashed zone to rinse the suds off
        </p>
      </div>

      <div
        ref={stageRef}
        className="relative w-full max-w-[300px] aspect-square rounded-2xl border-brutal-sm overflow-hidden bg-gradient-to-b from-sky-200 via-cyan-100 to-teal-200 shadow-inner"
      >
        {!hideBgImg ? (
          <img
            src={BATH_BACKGROUND_SRC}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover opacity-95 pointer-events-none"
            style={{ imageRendering: "pixelated" }}
            onError={() => setHideBgImg(true)}
          />
        ) : null}

        <div className="absolute inset-0 flex items-center justify-center pt-[14%] pointer-events-none pb-[6%]">
          <div className="w-[54%] select-none drop-shadow-[3px_3px_0_rgba(0,0,0,0.35)] z-[1]">
            <PixelPup slug={petSlug} size={120} />
          </div>
        </div>

        <div className="absolute inset-0 z-[2] pointer-events-none">
          <BathBubbleField washProgress={washProgress} />
        </div>

        {rinsingNow && washProgress < 98 ? (
          <div
            className="absolute inset-0 z-[3] pointer-events-none opacity-45"
            style={{
              background: `conic-gradient(from ${stagePct} at ${tipX * 100}% ${tipY * 100}%, transparent 0 35%, rgba(255,255,255,0.55) 50%, transparent 70% 100%)`,
            }}
          />
        ) : null}

        <div className="absolute border-2 border-dashed border-cyan-600/35 rounded-xl z-[4] pointer-events-none"
          style={{
            left: `${BATH_WASH_ZONE.l * 100}%`,
            top: `${BATH_WASH_ZONE.t * 100}%`,
            width: `${(BATH_WASH_ZONE.r - BATH_WASH_ZONE.l) * 100}%`,
            height: `${(BATH_WASH_ZONE.b - BATH_WASH_ZONE.t) * 100}%`,
          }}
        />

        <div
          role="presentation"
          data-testid="bath-nozzle"
          onPointerDown={onHosePointerDown}
          onPointerMove={onHosePointerMove}
          onPointerUp={onHosePointerUp}
          onPointerCancel={onHosePointerUp}
          className="absolute z-[6] cursor-grab active:cursor-grabbing touch-none flex items-center justify-center select-none"
          style={{
            left: `${hoseNorm.nx * 100}%`,
            top: `${hoseNorm.ny * 100}%`,
            transform: "translate(-50%, -50%)",
            width: hideShowerImg ? 52 : 64,
            height: hideShowerImg ? 52 : 68,
          }}
        >
          {!hideShowerImg ? (
            <img
              src={BATH_SHOWER_HEAD_SRC}
              alt=""
              draggable={false}
              className="w-full h-full object-contain drop-shadow-[3px_3px_0_rgba(0,0,0,0.85)] rotate-[-18deg]"
              style={{ imageRendering: "pixelated" }}
              onError={() => setHideShowerImg(true)}
            />
          ) : (
            <span className="text-4xl select-none rotate-[-12deg]" aria-hidden>
              🚿
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 w-[min(300px,90vw)]">
        <div className="h-3 rounded-full bg-muted border-brutal-sm overflow-hidden">
          <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: `${washProgress}%` }} />
        </div>
        <div className="text-center text-[10px] font-black uppercase mt-2 opacity-70">{scrubHint}</div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          data-testid="bath-cancel-btn"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-card border-brutal-sm shadow-brutal-sm font-black uppercase text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          data-testid="bath-done"
          onClick={bumpFinish}
          className="px-5 py-2 rounded-xl bg-cyan-300 border-brutal-sm shadow-brutal-sm font-black uppercase text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function WalkActivity({
  petSlug,
  onClose,
  onComplete,
}: {
  petSlug: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [pupX, setPupX] = useState(40);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const draggingRef = useRef<{ pointerId: number; startX: number; startProg: number } | null>(null);
  const doneSentRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          if (!doneSentRef.current) {
            doneSentRef.current = true;
            setTimeout(onComplete, 100);
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onComplete]);

  const trackWidth = trackRef.current?.clientWidth ?? 320;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { pointerId: e.pointerId, startX: e.clientX, startProg: progress };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = draggingRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const w = trackRef.current?.clientWidth ?? trackWidth;
    const dx = e.clientX - d.startX;
    const next = Math.max(0, Math.min(100, d.startProg + (dx / w) * 100));
    setProgress(next);
    setPupX(40 + (next / 100) * (w - 80));
    if (next >= 100) {
      draggingRef.current = null;
      if (!doneSentRef.current) {
        doneSentRef.current = true;
        setTimeout(onComplete, 200);
      }
    }
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current?.pointerId === e.pointerId) draggingRef.current = null;
  };

  return (
    <div
      data-testid="walk-overlay"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/95 p-4"
    >
      <button
        onClick={onClose}
        data-testid="walk-cancel"
        aria-label="Cancel walk"
        className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-card border-brutal-sm shadow-brutal-sm flex items-center justify-center"
      >
        <X className="w-5 h-5" strokeWidth={3} />
      </button>
      <div className="text-center mb-4">
        <h3 className="text-2xl font-black uppercase">Walkies!</h3>
        <p className="text-xs font-bold uppercase opacity-70 mt-1">
          Drag the pup along the leash · {secondsLeft}s left
        </p>
      </div>
      <div
        ref={trackRef}
        className="relative w-full max-w-[320px] h-32 bg-emerald-100 border-brutal-sm rounded-2xl overflow-hidden"
      >
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-foreground/30"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 8px, transparent 8px 14px)" }}
        />
        <div
          className="absolute right-3 top-1/2 -translate-y-1/2 text-3xl"
          aria-hidden
        >
          🏁
        </div>
        <div
          data-testid="walk-pup"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="absolute top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing w-16 h-16 flex items-center justify-center"
          style={{ left: pupX, transform: "translate(-50%, -50%)", touchAction: "none" }}
        >
          <PixelPup slug={petSlug} size={64} walking />
        </div>
      </div>
      <div className="mt-4 w-[320px]">
        <div className="h-3 rounded-full bg-muted border-brutal-sm overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-center text-[10px] font-black uppercase mt-2 opacity-70">
          {progress >= 100 ? "Good pup!" : `${Math.floor(progress)}% there`}
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          data-testid="walk-cancel-btn"
          onClick={onClose}
          className="px-5 py-2 rounded-xl bg-card border-brutal-sm shadow-brutal-sm font-black uppercase text-sm"
        >
          Cancel
        </button>
        <button
          data-testid="walk-done"
          onClick={onComplete}
          className="px-5 py-2 rounded-xl bg-emerald-300 border-brutal-sm shadow-brutal-sm font-black uppercase text-sm"
        >
          Done
        </button>
      </div>
    </div>
  );
}
