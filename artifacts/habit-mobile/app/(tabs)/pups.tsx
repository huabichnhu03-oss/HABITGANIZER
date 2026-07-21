import { Feather } from "@expo/vector-icons";
import {
  getGetCollectionQueryKey,
  getGetWalletQueryKey,
  getGetVisitorQueryKey,
  getListFoodsQueryKey,
  getListShopQueryKey,
  getListToysQueryKey,
  useBathPet,
  useBuyFood,
  useBuyPet,
  useBuyToy,
  useFeedPet,
  useGetCollection,
  useGetVisitor,
  useGetWallet,
  useListFoods,
  useListShop,
  useListToys,
  usePlayPet,
  usePlayWithVisitor,
  useRenamePet,
  useSetPetAccessoryLayout,
  useTrainPet,
  useWalkPet,
  useWaterPet,
  useWatchAdForCoins,
  useWatchAdVisitorSpeedup,
  formatPetCareErrorMessage,
  optimisticallyRenamePetInCollectionCache,
  patchOwnedPetInCollectionCache,
} from "@workspace/api-client-react";
import type { OwnedPet, PetAccessoryPlacement, PetMood, Wallet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatWaitRemaining, formatWaitRemainingA11y } from "../../lib/format-wait-label";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isRewardedAdReady, preloadRewardedAd, showRewardedAd } from "@/lib/admob";
import { API_URL } from "@/lib/config";
import { FriendsLeaderboardPanel } from "@/components/FriendsLeaderboardPanel";
import { BrutalCard } from "@/components/BrutalCard";
import { PixelPup } from "@/components/PixelPup";
import { PixelAccessory } from "@/components/PixelAccessory";
import { useColors } from "@/hooks/useColors";
import { usePrefetchOnFocus } from "@/hooks/usePrefetchOnFocus";

type AccessoryCategory = "head" | "eyes" | "neck" | "extras";

const ACCESSORIES: {
  id: string;
  label: string;
  category: AccessoryCategory;
  defaultX: number;
  defaultY: number;
}[] = [
  { id: "crown", label: "Crown", category: "head", defaultX: 0.5, defaultY: 0.12 },
  { id: "hat", label: "Top hat", category: "head", defaultX: 0.5, defaultY: 0.12 },
  { id: "cap", label: "Cap", category: "head", defaultX: 0.5, defaultY: 0.14 },
  { id: "graduate", label: "Grad cap", category: "head", defaultX: 0.5, defaultY: 0.12 },
  { id: "glasses", label: "Shades", category: "eyes", defaultX: 0.5, defaultY: 0.38 },
  { id: "specs", label: "Glasses", category: "eyes", defaultX: 0.5, defaultY: 0.38 },
  { id: "goggles", label: "Goggles", category: "eyes", defaultX: 0.5, defaultY: 0.38 },
  { id: "bowtie", label: "Bowtie", category: "neck", defaultX: 0.5, defaultY: 0.62 },
  { id: "scarf", label: "Scarf", category: "neck", defaultX: 0.5, defaultY: 0.66 },
  { id: "necktie", label: "Necktie", category: "neck", defaultX: 0.5, defaultY: 0.66 },
  { id: "bell", label: "Bell", category: "neck", defaultX: 0.5, defaultY: 0.62 },
  { id: "bone", label: "Bone", category: "extras", defaultX: 0.5, defaultY: 0.52 },
  { id: "flower", label: "Flower", category: "extras", defaultX: 0.28, defaultY: 0.22 },
  { id: "star", label: "Star", category: "extras", defaultX: 0.74, defaultY: 0.32 },
  { id: "beanie", label: "Beanie", category: "head", defaultX: 0.5, defaultY: 0.12 },
  { id: "party", label: "Party hat", category: "head", defaultX: 0.5, defaultY: 0.10 },
  { id: "halo", label: "Halo", category: "head", defaultX: 0.5, defaultY: 0.08 },
  { id: "santa", label: "Santa hat", category: "head", defaultX: 0.5, defaultY: 0.10 },
  { id: "monocle", label: "Monocle", category: "eyes", defaultX: 0.62, defaultY: 0.38 },
  { id: "heart-eye", label: "Hearts", category: "eyes", defaultX: 0.5, defaultY: 0.36 },
  { id: "collar", label: "Collar", category: "neck", defaultX: 0.5, defaultY: 0.66 },
  { id: "medal", label: "Medal", category: "neck", defaultX: 0.5, defaultY: 0.70 },
  { id: "pawprint", label: "Paw", category: "extras", defaultX: 0.3, defaultY: 0.78 },
  { id: "fire", label: "Fire", category: "extras", defaultX: 0.8, defaultY: 0.78 },
  { id: "rainbow", label: "Rainbow", category: "extras", defaultX: 0.18, defaultY: 0.30 },
  { id: "ball-toy", label: "Ball", category: "extras", defaultX: 0.85, defaultY: 0.85 },
];

const CATEGORY_ORDER: AccessoryCategory[] = ["head", "eyes", "neck", "extras"];
const CATEGORY_LABELS: Record<AccessoryCategory, string> = {
  head: "Head",
  eyes: "Eyes",
  neck: "Neck",
  extras: "Extras",
};

function accessoryDefault(id: string): { x: number; y: number } {
  const a = ACCESSORIES.find((x) => x.id === id);
  return { x: a?.defaultX ?? 0.5, y: a?.defaultY ?? 0.25 };
}

const COINS_SHORTAGE_MESSAGE =
  "You don't have enough coins yet. Complete habits and track more tasks to earn more.";
const COINS_NOTICE_MS = 4500;
const REWARD_POP_MS = 3000;

const WATCH_AD_PATRON_COPY =
  "Habiganize is non-profit. Watching a short ad is like buying our team a coffee at the café — thank you for helping keep the app free.";

/** Layered bath art (optional PNGs). Web: habit-tracker/public/pups-art/bath/. Native: same URLs on your API static host → imgSrc(). */
const BATH_ART_PATHS = {
  background: "/pups-art/bath/background.png",
  showerHead: "/pups-art/bath/shower-head.png",
} as const;

const BATH_STAGE_PX = 286;
const BATH_WASH_ZONE_N = { l: 0.22, r: 0.78, t: 0.3, b: 0.74 } as const;
const BATH_NOZZLE_OFFSET_PX = { x: -22, y: -32 } as const;

type ShopCategory = "pets" | "food" | "toys";

const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: "pets", label: "Pups" },
  { id: "food", label: "Food" },
  { id: "toys", label: "Toys" },
];

function isInsufficientCoinsError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { data?: { error?: string } | null; response?: { data?: { error?: string } }; message?: string };
  const body = e.response?.data?.error ?? e.data?.error ?? "";
  const msg = e.message ?? "";
  return /need\s+\d+\s+more\s+coins?/i.test(body) || /need\s+\d+\s+more\s+coins?/i.test(msg);
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null) {
    const e = err as {
      response?: { data?: { error?: string } };
      data?: { error?: string } | null;
      message?: string;
    };
    const fromBody = e.response?.data?.error ?? e.data?.error;
    if (fromBody) return fromBody;
    return e.message ?? fallback;
  }
  return fallback;
}

const MOOD_EMOJI: Record<PetMood, string> = {
  happy: "😄",
  content: "🙂",
  hungry: "🍗",
  thirsty: "💧",
  sad: "😢",
};

function getApiBase(): string {
  if (Platform.OS === "web") return "";
  return API_URL;
}

export default function PupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const qc = useQueryClient();
  usePrefetchOnFocus("pups");
  const [tab, setTab] = useState<"shop" | "collection" | "friends">("shop");
  const [shopCategory, setShopCategory] = useState<ShopCategory>("pets");
  const [openPetId, setOpenPetId] = useState<number | null>(null);
  const [coinNotice, setCoinNotice] = useState<string | null>(null);

  const showInsufficientCoinsNotice = () => setCoinNotice(COINS_SHORTAGE_MESSAGE);

  useEffect(() => {
    if (!coinNotice) return;
    const t = setTimeout(() => setCoinNotice(null), COINS_NOTICE_MS);
    return () => clearTimeout(t);
  }, [coinNotice]);

  const { data: wallet } = useGetWallet();
  const { data: shop, isLoading: shopLoading } = useListShop();
  const { data: collection, isLoading: collectionLoading } = useGetCollection();
  const buyPet = useBuyPet();

  const apiBase = useMemo(() => getApiBase(), []);
  const imgSrc = (path: string) => (path.startsWith("http") ? path : `${apiBase}${path}`);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListShopQueryKey() });
    qc.invalidateQueries({ queryKey: getGetCollectionQueryKey() });
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getListFoodsQueryKey() });
    qc.invalidateQueries({ queryKey: getListToysQueryKey() });
    qc.invalidateQueries({ queryKey: getGetVisitorQueryKey() });
  };

  const handleBuy = (slug: string, name: string, price: number) => {
    if ((wallet?.coins ?? 0) < price) {
      showInsufficientCoinsNotice();
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    buyPet.mutate(
      { slug },
      {
        onSuccess: () => {
          invalidate();
          setTab("collection");
          Alert.alert("New pup!", `${name} is now in your collection 🎉`);
        },
        onError: (err) => {
          if (isInsufficientCoinsError(err)) showInsufficientCoinsNotice();
          else Alert.alert("Oops", errorMessage(err, "Something went wrong"));
        },
      }
    );
  };

  const openPet = collection?.find((p) => p.id === openPetId) ?? null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
          paddingTop: (isWeb ? 67 : insets.top) + 16,
          paddingBottom: insets.bottom + 120,
        },
        ]}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <Text style={[styles.title, { color: colors.foreground }]} testID="text-pups-title">
          Pups
        </Text>

        {coinNotice && (
          <View
            testID="coin-notice"
            style={[
              styles.coinNoticeBanner,
              { backgroundColor: colors.accent, borderColor: colors.foreground },
            ]}
          >
            <View style={[styles.coinNoticeIcon, { borderColor: colors.foreground, backgroundColor: colors.background }]}>
              <Feather name="alert-circle" size={16} color={colors.foreground} />
            </View>
            <Text style={[styles.coinNoticeText, { color: colors.accentForeground }]}>{coinNotice}</Text>
            <Pressable
              testID="coin-notice-close"
              onPress={() => setCoinNotice(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.coinNoticeClose, { borderColor: colors.foreground, backgroundColor: colors.background }]}
            >
              <Feather name="x" size={14} color={colors.foreground} />
            </Pressable>
          </View>
        )}

        <BrutalCard background={colors.primary} containerStyle={{ marginTop: 12, marginBottom: 18 }} shadowOffset={7}>
          <View style={styles.coinHero}>
            <View>
              <Text style={[styles.heroLabel, { color: colors.primaryForeground }]}>YOUR STASH</Text>
              <Text style={[styles.heroNumber, { color: colors.primaryForeground }]} testID="text-coin-balance">
                {wallet?.coins ?? 0}
              </Text>
              <View style={styles.heroChips}>
                <View style={[styles.chip, { backgroundColor: colors.secondary, borderColor: colors.foreground }]}>
                  <Text style={styles.chipEmoji}>🍗</Text>
                  <Text style={[styles.chipText, { color: colors.foreground }]} testID="text-food-balance">
                    {wallet?.food ?? 0}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: colors.accent, borderColor: colors.foreground }]}>
                  <Text style={styles.chipEmoji}>💧</Text>
                  <Text style={[styles.chipText, { color: colors.foreground }]} testID="text-water-balance">
                    {wallet?.water ?? 0}
                  </Text>
                </View>
              </View>
            </View>
            <View style={[styles.coinBox, { backgroundColor: colors.accent, borderColor: colors.foreground }]}>
              <Feather name="dollar-sign" size={32} color={colors.foreground} />
            </View>
          </View>
        </BrutalCard>

        <WatchAdBonusCoinsRow onChanged={invalidate} colors={colors} />

        <VisitorRow imgSrc={imgSrc} onChanged={invalidate} colors={colors} />

        <View style={styles.tabRow}>
          <Pressable
            testID="tab-shop"
            onPress={() => setTab("shop")}
            style={[
              styles.tabBtn,
              {
                backgroundColor: tab === "shop" ? colors.accent : colors.card,
                borderColor: colors.foreground,
              },
            ]}
          >
            <Text style={[styles.tabLabel, { color: colors.foreground }]}>Shop</Text>
          </Pressable>
          <Pressable
            testID="tab-collection"
            onPress={() => setTab("collection")}
            style={[
              styles.tabBtn,
              {
                backgroundColor: tab === "collection" ? colors.accent : colors.card,
                borderColor: colors.foreground,
              },
            ]}
          >
            <Text style={[styles.tabLabel, { color: colors.foreground }]}>
              Pack ({collection?.length ?? 0})
            </Text>
          </Pressable>
          <Pressable
            testID="tab-friends"
            onPress={() => setTab("friends")}
            style={[
              styles.tabBtn,
              {
                backgroundColor: tab === "friends" ? colors.accent : colors.card,
                borderColor: colors.foreground,
              },
            ]}
          >
            <Text style={[styles.tabLabel, { color: colors.foreground }]}>Friends</Text>
          </Pressable>
        </View>

        {tab === "shop" ? (
          <View style={{ marginTop: 16 }}>
            <View style={styles.shopCatTabList} accessibilityRole="tablist">
              {SHOP_CATEGORIES.map(({ id, label }) => {
                const active = shopCategory === id;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    testID={`shop-section-${id}`}
                    onPress={() => setShopCategory(id)}
                    style={[
                      styles.shopCatTab,
                      {
                        borderColor: colors.foreground,
                        backgroundColor: active ? colors.card : colors.muted,
                        zIndex: active ? 3 : 1,
                        marginBottom: active ? -3 : 0,
                        paddingBottom: active ? 14 : 10,
                        opacity: active ? 1 : 0.92,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.shopCatTabLabel,
                        { color: colors.foreground, opacity: active ? 1 : 0.72 },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View
              style={[
                styles.shopPanel,
                {
                  borderColor: colors.foreground,
                  backgroundColor: colors.card,
                },
              ]}
            >
              {shopCategory === "pets" &&
                (shopLoading ? (
                  <ActivityIndicator size="large" color={colors.foreground} style={{ paddingVertical: 40 }} />
                ) : (
                  shop?.map((pet) => (
                    <BrutalCard
                      key={pet.slug}
                      background={colors.card}
                      shadowOffset={6}
                      containerStyle={{ marginBottom: 14 }}
                    >
                      <View style={styles.petRow}>
                        <View
                          style={[styles.petImageBox, { backgroundColor: colors.secondary, borderColor: colors.foreground }]}
                        >
                          <Image
                            source={{ uri: imgSrc(pet.imageUrl) }}
                            style={styles.petImage}
                            resizeMode="contain"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.petName, { color: colors.foreground }]}>{pet.name}</Text>
                          <Text style={[styles.petBreed, { color: colors.foreground, opacity: 0.6 }]}>{pet.breed}</Text>
                          <Text style={[styles.petDesc, { color: colors.foreground, opacity: 0.8 }]} numberOfLines={2}>
                            {pet.description}
                          </Text>
                          {pet.owned ? (
                            <View style={[styles.priceTag, { backgroundColor: colors.muted, borderColor: colors.foreground }]}>
                              <Text style={[styles.priceText, { color: colors.foreground }]}>OWNED</Text>
                            </View>
                          ) : (
                            <Pressable
                              testID={`buy-${pet.slug}`}
                              onPress={() => handleBuy(pet.slug, pet.name, pet.price)}
                              style={[styles.priceTag, { backgroundColor: colors.accent, borderColor: colors.foreground }]}
                            >
                              <Feather name="dollar-sign" size={14} color={colors.foreground} />
                              <Text style={[styles.priceText, { color: colors.foreground }]}>{pet.price}</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    </BrutalCard>
                  ))
                ))}
              {shopCategory === "food" && (
                <FoodsRow onChanged={invalidate} colors={colors} onInsufficientCoins={showInsufficientCoinsNotice} />
              )}
              {shopCategory === "toys" && (
                <ToysRow onChanged={invalidate} colors={colors} onInsufficientCoins={showInsufficientCoinsNotice} />
              )}
            </View>
          </View>
        ) : tab === "collection" ? (
          collectionLoading ? (
            <ActivityIndicator size="large" color={colors.foreground} style={{ marginTop: 30 }} />
          ) : collection && collection.length > 0 ? (
            <View style={{ gap: 14, marginTop: 16 }}>
              {collection.map((pet) => (
                <Pressable
                  key={pet.id}
                  testID={`owned-pet-${pet.slug}`}
                  onPress={() => setOpenPetId(pet.id)}
                >
                  <BrutalCard background={colors.card} shadowOffset={6}>
                    <View style={styles.petRow}>
                      <View style={[styles.petImageBox, { backgroundColor: colors.accent, borderColor: colors.foreground }]}>
                        <Image
                          source={{ uri: imgSrc(pet.imageUrl) }}
                          style={styles.petImage}
                          resizeMode="contain"
                        />
                        {pet.accessoryLayout.map((p, i) => (
                          <View
                            key={i}
                            style={[
                              styles.miniAccessory,
                              { left: `${p.x * 100}%`, top: `${p.y * 100}%` },
                            ]}
                          >
                            <PixelAccessory id={p.accessoryId} size={32} />
                          </View>
                        ))}
                        <Text style={styles.miniMood}>{MOOD_EMOJI[pet.mood]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                          <Text style={[styles.petName, { color: colors.foreground }]}>{pet.name}</Text>
                          <Text style={[styles.petBreed, { color: colors.foreground, opacity: 0.6 }]}>
                            LV {pet.level}
                          </Text>
                        </View>
                        <Text style={[styles.petBreed, { color: colors.foreground, opacity: 0.6 }]}>{pet.breed}</Text>
                        <MiniMeter label="🍗" value={pet.hunger} color={colors.secondary} foreground={colors.foreground} />
                        <MiniMeter label="💧" value={pet.thirst} color={colors.accent} foreground={colors.foreground} />
                        <Text style={[styles.tapHint, { color: colors.foreground }]}>Tap to care &amp; dress up</Text>
                      </View>
                    </View>
                  </BrutalCard>
                </Pressable>
              ))}
            </View>
          ) : (
            <BrutalCard background={colors.card} containerStyle={{ marginTop: 16 }}>
              <View style={styles.empty}>
                <Text style={{ fontSize: 48 }}>🐶</Text>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No pups yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.foreground, opacity: 0.65 }]}>
                  Complete habits to earn coins, then come back to adopt your first pup!
                </Text>
              </View>
            </BrutalCard>
          )
        ) : (
          <FriendsLeaderboardPanel active={tab === "friends"} />
        )}
      </ScrollView>

      {openPet && (
        <PetDetailModal
          pet={openPet}
          wallet={wallet}
          imgSrc={imgSrc}
          onClose={() => setOpenPetId(null)}
          onChanged={invalidate}
        />
      )}
    </View>
  );
}

function MiniMeter({
  label,
  value,
  color,
  foreground,
}: {
  label: string;
  value: number;
  color: string;
  foreground: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.miniMeterRow}>
      <Text style={{ fontSize: 12 }}>{label}</Text>
      <View style={[styles.miniMeterTrack, { borderColor: foreground }]}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
      </View>
      <Text style={[styles.miniMeterText, { color: foreground }]}>{pct}</Text>
    </View>
  );
}


function PetDetailModal({
  pet,
  wallet,
  imgSrc,
  onClose,
  onChanged,
}: {
  pet: OwnedPet;
  wallet: Wallet | undefined;
  imgSrc: (p: string) => string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const colors = useColors();
  const insets = useSafeAreaInsets();
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
  useEffect(() => {
    if (!editingName) setNameDraft(pet.name);
  }, [pet.name, editingName]);
  const submitName = () => {
    if (!editingName || renamePet.isPending) return;
    const trimmed = nameDraft.trim().slice(0, 30);
    if (trimmed.length === 0) {
      Alert.alert("Name can't be empty");
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
        Alert.alert("Couldn't rename", errorMessage(err, "Try again"));
        setNameDraft(pet.name);
        setEditingName(false);
      }
    })();
  };
  const careBusy = renamePet.isPending;
  const [reward, setReward] = useState<{ id: number; label: string } | null>(null);
  useEffect(() => {
    const t = setInterval(() => onChanged(), 15000);
    return () => clearInterval(t);
  }, [onChanged]);
  const popReward = (label: string) => {
    const id = Date.now();
    setReward({ id, label });
    setTimeout(() => setReward((r) => (r?.id === id ? null : r)), REWARD_POP_MS);
  };

  const [layout, setLocalLayout] = useState<PetAccessoryPlacement[]>(pet.accessoryLayout);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const canvasRef = useRef<View>(null);
  const canvasPosRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const measureCanvas = () => {
    canvasRef.current?.measureInWindow((x, y, width, height) => {
      canvasPosRef.current = { x, y, width, height };
    });
  };
  const hitTestCanvas = (absX: number, absY: number) => {
    const r = canvasPosRef.current;
    if (r.width <= 0 || r.height <= 0) return null;
    const lx = absX - r.x;
    const ly = absY - r.y;
    if (lx < 0 || ly < 0 || lx > r.width || ly > r.height) return null;
    return { x: lx / r.width, y: ly / r.height };
  };
  const dropFromTray = (accessoryId: string, absX: number, absY: number) => {
    canvasRef.current?.measureInWindow((x, y, width, height) => {
      canvasPosRef.current = { x, y, width, height };
      const norm = hitTestCanvas(absX, absY);
      if (norm) addAccessoryAt(accessoryId, norm.x, norm.y);
    });
  };

  useEffect(() => {
    setLocalLayout(pet.accessoryLayout);
  }, [pet.accessoryLayout]);

  const persistLayout = (next: PetAccessoryPlacement[]) => {
    setLayout.mutate(
      { id: pet.id, data: { accessoryLayout: next } },
      { onSuccess: () => onChanged() }
    );
  };

  const handleFeed = () => {
    feedPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => { popReward("+35 🍗"); onChanged(); },
        onError: (err) =>
          Alert.alert(
            "Can't feed",
            formatPetCareErrorMessage(err, pet.name, "No food left — complete a habit!")
          ),
      }
    );
  };
  const handleWater = () => {
    waterPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => { popReward("+35 💧"); onChanged(); },
        onError: (err) =>
          Alert.alert("Can't water", formatPetCareErrorMessage(err, pet.name, "No water left — complete a habit!")),
      }
    );
  };
  const handlePlay = () => {
    playPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => { popReward("+100 🎾"); onChanged(); },
        onError: (err) => Alert.alert("Play on cooldown", errorMessage(err, "Try again later")),
      }
    );
  };
  const handleWalkComplete = () => {
    walkPet.mutate(
      { id: pet.id },
      {
        onSuccess: () => { popReward("+100 🐾"); onChanged(); setWalkOpen(false); },
        onError: (err) => {
          Alert.alert("Walk on cooldown", errorMessage(err, "Try again later"));
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
          popReward("+100 🛁");
          onChanged();
          setBathOpen(false);
        },
        onError: (err) => {
          Alert.alert("Bath on cooldown", errorMessage(err, "Try again later"));
          setBathOpen(false);
        },
      }
    );
  };

  const addAccessoryAt = (id: string, x: number, y: number) => {
    setLocalLayout((prev) => {
      const next = [...prev, { accessoryId: id, x, y }];
      persistLayout(next);
      return next;
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  };
  const addAccessory = (id: string) => {
    const d = accessoryDefault(id);
    addAccessoryAt(id, d.x, d.y);
  };

  const updateAt = (index: number, x: number, y: number) => {
    setLocalLayout((prev) => {
      const copy = [...prev];
      if (copy[index]) copy[index] = { ...copy[index], x, y };
      return copy;
    });
  };

  const commitAt = (index: number, x: number, y: number) => {
    setLocalLayout((prev) => {
      const next = prev.map((p, i) => (i === index ? { ...p, x, y } : p));
      persistLayout(next);
      return next;
    });
  };

  const removeAt = (index: number) => {
    setLocalLayout((prev) => {
      const next = prev.filter((_, i) => i !== index);
      persistLayout(next);
      return next;
    });
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
      <View style={[styles.modalBackdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.foreground }]} testID="pet-detail-modal">
          <View style={[styles.modalHeader, { borderColor: colors.foreground }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              {editingName ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TextInput
                    testID="pet-name-input"
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    onBlur={submitName}
                    onSubmitEditing={submitName}
                    autoFocus
                    maxLength={30}
                    returnKeyType="done"
                    style={[
                      styles.modalTitle,
                      {
                        color: colors.foreground,
                        flex: 1,
                        borderWidth: 2,
                        borderColor: colors.foreground,
                        borderRadius: 6,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        backgroundColor: colors.card,
                      },
                    ]}
                  />
                  <Pressable
                    testID="pet-name-save"
                    onPress={submitName}
                    style={[styles.closeBtn, { borderColor: colors.foreground, backgroundColor: "#86efac" }]}
                  >
                    <Feather name="check" size={18} color={colors.foreground} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  testID="pet-name-edit"
                  onPress={() => { setNameDraft(pet.name); setEditingName(true); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <Text style={[styles.modalTitle, { color: colors.foreground, flexShrink: 1 }]} numberOfLines={1}>
                    {pet.name}
                  </Text>
                  <Feather name="edit-2" size={16} color={colors.foreground} style={{ opacity: 0.6 }} />
                </Pressable>
              )}
              <Text style={[styles.modalSubtitle, { color: colors.foreground }]}>
                {pet.breed} · LV {pet.level} · {pet.mood}
              </Text>
            </View>
            <Pressable
              testID="close-pet-detail"
              onPress={onClose}
              style={[styles.closeBtn, { borderColor: colors.foreground, backgroundColor: colors.card }]}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            alwaysBounceVertical={false}
            overScrollMode="never"
          >
            <View
              ref={canvasRef}
              testID="pet-canvas"
              onLayout={(e) => {
                setCanvasSize({
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                });
                measureCanvas();
              }}
              style={[styles.canvas, { backgroundColor: colors.secondary, borderColor: colors.foreground }]}
            >
              <View style={styles.canvasPup} pointerEvents="none">
                <Image
                  source={{ uri: imgSrc(pet.imageUrl) }}
                  style={{ width: "85%", height: "85%", maxWidth: "100%", maxHeight: "100%" }}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.moodOverlay}>{MOOD_EMOJI[pet.mood]}</Text>
              {reward && (
                <View key={reward.id} style={[styles.rewardPop, { borderColor: colors.foreground, backgroundColor: colors.accent }]} pointerEvents="none">
                  <Text style={[styles.rewardText, { color: colors.foreground }]}>{reward.label}</Text>
                </View>
              )}
              {layout.map((p, i) => (
                <DraggableAccessory
                  key={`${p.accessoryId}-${i}`}
                  index={i}
                  placement={p}
                  canvasSize={canvasSize}
                  onMove={updateAt}
                  onCommit={commitAt}
                  onRemove={removeAt}
                />
              ))}
            </View>

            <View style={styles.careGrid}>
              <CareTile label="Walk" emoji="🐾" value={pet.walk} status={pet.walkLabel} fill="#86efac" foreground={colors.foreground} />
              <CareTile label="Bath" emoji="🛁" value={pet.bath} status={pet.bathLabel} fill="#67e8f9" foreground={colors.foreground} />
              <CareTile label="Feed" emoji="🍗" value={pet.hunger} status={pet.feedLabel} fill="#f9a8d4" foreground={colors.foreground} />
              <CareTile label="Play" emoji="🎾" value={pet.play} status={pet.playLabel} fill="#c4b5fd" foreground={colors.foreground} />
            </View>

            <View style={styles.actionGrid}>
              <ActionTile testID={`walk-${pet.id}`} emoji="🐾" label="Walk" hint={pet.walkLabel} bg="#86efac" fg={colors.foreground} disabled={careBusy || walkPet.isPending || !pet.walkReady} onPress={() => setWalkOpen(true)} />
              <ActionTile testID={`bath-${pet.id}`} emoji="🛁" label="Bath" hint={pet.bathLabel} bg="#67e8f9" fg={colors.foreground} disabled={careBusy || bathPet.isPending || !pet.bathReady} onPress={() => setBathOpen(true)} />
              <ActionTile testID={`feed-${pet.id}`} emoji="🍗" label="Feed" hint={pet.feedLabel} bg="#f9a8d4" fg={colors.foreground} disabled={careBusy || feedPet.isPending || !pet.feedReady} onPress={handleFeed} />
              <ActionTile testID={`play-${pet.id}`} emoji="🎾" label="Play" hint={pet.playLabel} bg="#c4b5fd" fg={colors.foreground} disabled={careBusy || playPet.isPending || !pet.playReady} onPress={handlePlay} />
            </View>

            <Pressable
              testID={`train-${pet.id}`}
              disabled={careBusy || trainPet.isPending || pet.level >= 10}
              onPress={() =>
                trainPet.mutate(
                  { id: pet.id },
                  {
                    onSuccess: (res) => {
                      popReward(res.leveledUp ? `LV UP! → ${res.pet.level}` : `+1 trick`);
                      onChanged();
                    },
                    onError: (err) => Alert.alert("Can't train", errorMessage(err, "Try again later")),
                  }
                )
              }
              style={[styles.waterBtn, { borderColor: colors.foreground, backgroundColor: "#fcd34d", opacity: pet.level >= 10 ? 0.5 : 1 }]}
            >
              <Text style={[styles.actionText, { color: colors.foreground }]}>
                🎓 Train · 5 🪙{pet.level >= 10 ? " · MAX" : ""}
              </Text>
            </Pressable>

            {(wallet?.water ?? 0) > 0 && (
              <Pressable
                testID={`water-${pet.id}`}
                onPress={handleWater}
                disabled={careBusy || waterPet.isPending || pet.thirst >= 100}
                style={[styles.waterBtn, { borderColor: colors.foreground, backgroundColor: colors.accent, opacity: pet.thirst >= 100 ? 0.5 : 1 }]}
              >
                <Text style={[styles.actionText, { color: colors.foreground }]}>
                  💧 Water · {pet.thirst}% · {wallet?.water ?? 0} left
                </Text>
              </Pressable>
            )}

            <View>
              <Text style={[styles.trayHeading, { color: colors.foreground }]}>
                Accessory tray · tap to add, drag to place, drag off to remove
              </Text>
              <View style={[styles.tray, { backgroundColor: colors.muted, borderColor: colors.foreground }]}>
                {CATEGORY_ORDER.map((cat) => {
                  const items = ACCESSORIES.filter((a) => a.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <View key={cat} style={styles.trayCategory}>
                      <Text style={[styles.trayCategoryLabel, { color: colors.foreground }]}>
                        {CATEGORY_LABELS[cat]}
                      </Text>
                      <View style={styles.trayRow}>
                        {items.map((a) => (
                          <DraggableTrayItem
                            key={a.id}
                            accessoryId={a.id}
                            bg={colors.card}
                            border={colors.foreground}
                            onDrop={(absX, absY) => dropFromTray(a.id, absX, absY)}
                            onTap={() => addAccessory(a.id)}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
              {layout.length > 0 && (
                <Pressable
                  testID="clear-layout"
                  onPress={() => {
                    setLocalLayout(() => {
                      persistLayout([]);
                      return [];
                    });
                  }}
                  style={[styles.clearBtn, { backgroundColor: colors.card, borderColor: colors.foreground }]}
                >
                  <Feather name="trash-2" size={16} color={colors.foreground} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>Clear all</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
      {walkOpen && (
        <WalkActivity
          imageUri={imgSrc(pet.imageUrl)}
          onClose={() => setWalkOpen(false)}
          onComplete={handleWalkComplete}
        />
      )}
      {bathOpen && (
        <BathActivity
          imageUri={imgSrc(pet.imageUrl)}
          backgroundUri={imgSrc(BATH_ART_PATHS.background)}
          showerUri={imgSrc(BATH_ART_PATHS.showerHead)}
          onClose={() => setBathOpen(false)}
          onComplete={handleBathComplete}
        />
      )}
      </View>
    </Modal>
  );
}

type ColorScheme = ReturnType<typeof useColors>;

type WatchAdPhase = "intro" | "watch" | "grant";

function WatchAdSupportModalRN({
  visible,
  onClose,
  headline,
  rewardLine,
  grantRef,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  headline: string;
  rewardLine: string;
  grantRef: React.MutableRefObject<() => Promise<void>>;
  colors: ColorScheme;
}) {
  const [phase, setPhase] = useState<WatchAdPhase>("intro");
  const [rewardedReady, setRewardedReady] = useState(false);

  useEffect(() => {
    if (!visible) {
      setPhase("intro");
      setRewardedReady(false);
      return;
    }
    if (Platform.OS === "web") return;
    setRewardedReady(isRewardedAdReady());
    void preloadRewardedAd().then((ok) => setRewardedReady(ok || isRewardedAdReady()));
  }, [visible]);

  useEffect(() => {
    if (phase !== "watch" || !visible) return;
    let cancelled = false;
    void (async () => {
      const result = await showRewardedAd();
      if (cancelled) return;
      if (result === "earned") {
        setPhase("grant");
        return;
      }
      onClose();
      setPhase("intro");
      if (result === "dismissed") {
        Alert.alert("Ad skipped", "Watch the full sponsor message to earn your reward.");
      } else if (result === "unavailable") {
        Alert.alert(
          "Ad unavailable",
          "Rewarded ads need a native build with AdMob configured (not Expo Go). Try again on a release build.",
        );
      } else {
        Alert.alert("Ad unavailable", "Couldn't load a sponsor message right now. Try again in a bit.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, visible, onClose]);
  useEffect(() => {
    if (phase !== "grant" || !visible) return;
    let cancelled = false;
    void (async () => {
      try {
        await grantRef.current();
      } finally {
        if (!cancelled) {
          onClose();
          setPhase("intro");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, visible, grantRef, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 3,
            borderColor: colors.foreground,
            padding: 18,
            gap: 12,
          }}
        >
          <Text style={{ fontFamily: "Inter_900Black", fontSize: 18, color: colors.foreground }}>{headline}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground, lineHeight: 19 }}>{WATCH_AD_PATRON_COPY}</Text>
          {phase === "intro" && (
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, opacity: 0.85 }}>{rewardLine}</Text>
          )}
          {phase === "watch" && (
            <View style={{ alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <ActivityIndicator size="large" color={colors.foreground} />
              <Text style={{ textAlign: "center", fontWeight: "900", color: colors.foreground }}>
                {rewardedReady ? "Opening rewarded video…" : "Loading rewarded ad…"}
              </Text>
            </View>
          )}
          {phase === "grant" && (
            <Text style={{ textAlign: "center", fontWeight: "900", color: colors.foreground }}>Claiming reward…</Text>
          )}
          {phase === "intro" && Platform.OS !== "web" && (
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground, opacity: 0.75 }}>
              {rewardedReady ? "Rewarded video is ready." : "Preparing rewarded video…"}
            </Text>
          )}
          {phase === "intro" ? (
            <Pressable
              onPress={() => {
                setRewardedReady(isRewardedAdReady());
                setPhase("watch");
              }}
              style={{
                marginTop: 4,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 3,
                borderColor: colors.foreground,
                backgroundColor: colors.accent,
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.foreground, textTransform: "uppercase" }}>Watch AdMob ad</Text>
            </Pressable>
          ) : (
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground, opacity: 0.7, textAlign: "center" }}>
              Please keep this open for a moment.
            </Text>
          )}
          {phase === "intro" && (
            <Pressable onPress={onClose} hitSlop={8} style={{ alignSelf: "center", paddingVertical: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground, textDecorationLine: "underline" }}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

function WatchAdBonusCoinsRow({ onChanged, colors }: { onChanged: () => void; colors: ColorScheme }) {
  const [open, setOpen] = useState(false);
  const grantRef = useRef(() => Promise.resolve());
  const watchCoins = useWatchAdForCoins();
  grantRef.current = async () => {
    try {
      const res = await watchCoins.mutateAsync();
      onChanged();
      Alert.alert("Bonus coins!", `+${res.coinsAwarded} coins — thank you for supporting Habiganize.`);
    } catch (err) {
      Alert.alert("Couldn’t claim reward", errorMessage(err, "Try again later."));
    }
  };
  return (
    <>
      <WatchAdSupportModalRN
        visible={open}
        onClose={() => setOpen(false)}
        headline="Earn bonus coins"
        rewardLine="A short rewarded AdMob video adds bonus coins when you finish it."
        grantRef={grantRef}
        colors={colors}
      />
      <BrutalCard background="#fde68a" containerStyle={{ marginBottom: 14 }} shadowOffset={5}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.foreground, lineHeight: 16, marginBottom: 10 }}>
          {WATCH_AD_PATRON_COPY}
        </Text>
        <Pressable
          testID="watch-ad-coins-btn"
          disabled={watchCoins.isPending}
          onPress={() => setOpen(true)}
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: colors.foreground,
            backgroundColor: colors.accent,
            opacity: watchCoins.isPending ? 0.5 : 1,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.foreground, textTransform: "uppercase", fontSize: 12 }}>
            Watch ad · bonus coins
          </Text>
        </Pressable>
      </BrutalCard>
    </>
  );
}

function VisitorRow({
  imgSrc,
  onChanged,
  colors,
}: {
  imgSrc: (p: string) => string;
  onChanged: () => void;
  colors: ColorScheme;
}) {
  const { data: visitor } = useGetVisitor({
    query: {
      queryKey: getGetVisitorQueryKey(),
      // While on cooldown the server hides name/slug; poll so **Play** unlocks soon after cooldown without a navigation refresh.
      refetchInterval: (q) => {
        const v = q.state.data;
        return v?.ready === false ? 10_000 : false;
      },
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
      Alert.alert("Wait shortened", `${desc} Thanks for supporting our non-profit.`);
    } catch (err) {
      Alert.alert("Speed-up unavailable", errorMessage(err, "Try again later."));
    }
  };

  if (!visitor) return null;
  const cooldownMs = new Date(visitor.availableAt).getTime() - now;
  const ready = visitor.ready;
  const showPet = Boolean(ready && visitor.name);
  return (
    <>
      <WatchAdSupportModalRN
        visible={adOpen}
        onClose={() => setAdOpen(false)}
        headline="Speed up playdate wait"
        rewardLine="A short rewarded AdMob video shaves time off the wait for your next visitor."
        grantRef={grantSpeedRef}
        colors={colors}
      />
      <BrutalCard background="#fbcfe8" containerStyle={{ marginBottom: 14 }} shadowOffset={6}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} testID="visitor-card">
          <View style={[styles.petImageBox, { width: 64, height: 64, backgroundColor: "#fff", borderColor: colors.foreground }]}>
            {visitor.imageUrl ? (
              <Image source={{ uri: imgSrc(visitor.imageUrl) }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
            ) : visitor.slug ? (
              <PixelPup slug={visitor.slug} size={62} />
            ) : (
              <Feather name="clock" size={30} color={colors.foreground} />
            )}
          </View>
          <View style={{ flex: 1, flexShrink: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 10, fontWeight: "900", textTransform: "uppercase", color: colors.foreground, opacity: 0.7 }}>
              {showPet ? "Today's playdate visitor" : "Today's playdate"}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: colors.foreground }} numberOfLines={1}>
              {showPet ? visitor.name : "Next pup on the way"}
            </Text>
            <Text style={{ fontSize: 11, color: colors.foreground, opacity: 0.7 }} numberOfLines={1}>
              {showPet ? visitor.breed ?? "" : ""}
            </Text>
            {!ready && (
              <Text style={{ fontSize: 10, fontWeight: "700", color: colors.foreground, marginTop: 6, lineHeight: 14, opacity: 0.88 }}>
                Watch a short ad to skip part of this wait — it helps our non-profit, like buying the team a coffee at the café.
              </Text>
            )}
            {reward && <Text style={{ fontSize: 11, fontWeight: "900", color: colors.foreground }}>{reward}</Text>}
          </View>
          <View style={{ flexShrink: 0, gap: 6, alignItems: "stretch" }}>
            <Pressable
              testID="visitor-play-btn"
              accessibilityLabel={
                ready ? "Play with today’s visitor and earn fifteen coins" : formatWaitRemainingA11y(cooldownMs)
              }
              accessibilityHint={ready ? undefined : "You can play again when the timer finishes."}
              disabled={!ready || playVisitor.isPending}
              onPress={() =>
                playVisitor.mutate(undefined, {
                  onSuccess: (res) => {
                    setReward(`+${res.coinsAwarded} coins!`);
                    setTimeout(() => setReward(null), 4000);
                    onChanged();
                  },
                  onError: (err) => Alert.alert("Visit on cooldown", errorMessage(err, "Come back later")),
                })
              }
              style={{
                paddingHorizontal: ready ? 14 : 10,
                paddingVertical: ready ? 10 : 11,
                borderRadius: 10,
                borderWidth: 3,
                borderColor: colors.foreground,
                backgroundColor: colors.accent,
                opacity: !ready || playVisitor.isPending ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontWeight: "900",
                  color: colors.foreground,
                  fontSize: ready ? 13 : 13,
                  lineHeight: ready ? undefined : 16,
                  letterSpacing: ready ? undefined : -0.2,
                  textTransform: ready ? "uppercase" : "none",
                  textAlign: "center",
                  fontVariant: ready ? undefined : ["tabular-nums"],
                }}
                maxFontSizeMultiplier={ready ? undefined : 1.25}
                numberOfLines={1}
              >
                {ready ? "Play +15🪙" : formatWaitRemaining(cooldownMs)}
              </Text>
            </Pressable>
            {!ready && (
              <Pressable
                testID="visitor-watch-ad-speed-btn"
                disabled={watchSpeedup.isPending}
                onPress={() => setAdOpen(true)}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 2,
                  borderColor: colors.foreground,
                  backgroundColor: "#ffffff",
                  opacity: watchSpeedup.isPending ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 10, textTransform: "uppercase", textAlign: "center" }}>
                  Ad · speed up
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </BrutalCard>
    </>
  );
}

function FoodsRow({
  onChanged,
  colors,
  onInsufficientCoins,
}: {
  onChanged: () => void;
  colors: ColorScheme;
  onInsufficientCoins: () => void;
}) {
  const { data: foods, isLoading } = useListFoods();
  const buyFood = useBuyFood();
  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.foreground} style={{ paddingVertical: 36 }} />;
  }
  if (!foods || foods.length === 0) {
    return (
      <View testID="food-shop" style={{ paddingVertical: 28, alignItems: "center" }}>
        <Text style={{ fontFamily: "Inter_900Black", fontSize: 16, color: colors.foreground, opacity: 0.85 }}>
          No foods in the shop
        </Text>
        <Text style={{ marginTop: 8, fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground, opacity: 0.55, textAlign: "center" }}>
          Check back later for new treats.
        </Text>
      </View>
    );
  }
  return (
    <View testID="food-shop" style={{ gap: 10, marginTop: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: colors.foreground, textTransform: "uppercase" }}>
        🍽️ Foods
      </Text>
      {foods.map((food) => (
        <BrutalCard key={food.slug} background={colors.card} shadowOffset={5}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} testID={`food-${food.slug}`}>
            <Text style={{ fontSize: 32 }}>{food.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: colors.foreground }}>{food.name}</Text>
              <Text style={{ fontSize: 11, color: colors.foreground, opacity: 0.7 }} numberOfLines={2}>
                {food.description}
              </Text>
              <Text style={{ fontSize: 10, color: colors.foreground, opacity: 0.7 }}>
                +{food.hungerAmount}🍗 +{food.bonusLevel}⭐ · Owned: {food.owned}
              </Text>
            </View>
            <Pressable
              testID={`buy-food-${food.slug}`}
              disabled={buyFood.isPending}
              onPress={() =>
                buyFood.mutate(
                  { slug: food.slug },
                  {
                    onSuccess: () => onChanged(),
                    onError: (err) => {
                      if (isInsufficientCoinsError(err)) onInsufficientCoins();
                      else Alert.alert("Can't buy", errorMessage(err, "Something went wrong"));
                    },
                  }
                )
              }
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 3,
                borderColor: colors.foreground,
                backgroundColor: colors.accent,
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 12 }}>🪙 {food.price}</Text>
            </Pressable>
          </View>
        </BrutalCard>
      ))}
    </View>
  );
}

function ToysRow({
  onChanged,
  colors,
  onInsufficientCoins,
}: {
  onChanged: () => void;
  colors: ColorScheme;
  onInsufficientCoins: () => void;
}) {
  const { data: toys, isLoading } = useListToys();
  const buyToy = useBuyToy();
  if (isLoading) {
    return <ActivityIndicator size="large" color={colors.foreground} style={{ paddingVertical: 36 }} />;
  }
  if (!toys || toys.length === 0) {
    return (
      <View testID="toy-shop" style={{ paddingVertical: 28, alignItems: "center" }}>
        <Text style={{ fontFamily: "Inter_900Black", fontSize: 16, color: colors.foreground, opacity: 0.85 }}>
          No toys in the shop
        </Text>
        <Text style={{ marginTop: 8, fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground, opacity: 0.55, textAlign: "center" }}>
          Check back later for new toys.
        </Text>
      </View>
    );
  }
  return (
    <View testID="toy-shop" style={{ gap: 10, marginTop: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "900", color: colors.foreground, textTransform: "uppercase" }}>
        🎾 Toys
      </Text>
      {toys.map((toy) => (
        <BrutalCard key={toy.slug} background={colors.card} shadowOffset={5}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} testID={`toy-${toy.slug}`}>
            <Text style={{ fontSize: 32 }}>{toy.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "900", color: colors.foreground }}>{toy.name}</Text>
              <Text style={{ fontSize: 11, color: colors.foreground, opacity: 0.7 }} numberOfLines={2}>
                {toy.description}
              </Text>
              <Text
                style={{ marginTop: 4, fontSize: 11, lineHeight: 15, color: colors.foreground, opacity: 0.75 }}
                numberOfLines={2}
              >
                😄 +{toy.happinessGain} happier · wait {toy.cooldownMinutes} minutes between plays
              </Text>
            </View>
            {toy.owned ? (
              <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 3, borderColor: colors.foreground, backgroundColor: colors.muted }}>
                <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 11 }}>OWNED</Text>
              </View>
            ) : (
              <Pressable
                testID={`buy-toy-${toy.slug}`}
                disabled={buyToy.isPending}
                onPress={() =>
                  buyToy.mutate(
                    { slug: toy.slug },
                    {
                      onSuccess: () => onChanged(),
                      onError: (err) => {
                        if (isInsufficientCoinsError(err)) onInsufficientCoins();
                        else Alert.alert("Can't buy", errorMessage(err, "Something went wrong"));
                      },
                    }
                  )
                }
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 3,
                  borderColor: colors.foreground,
                  backgroundColor: colors.accent,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 12 }}>🪙 {toy.price}</Text>
              </Pressable>
            )}
          </View>
        </BrutalCard>
      ))}
    </View>
  );
}

function CareTile({
  label,
  emoji,
  value,
  status,
  fill,
  foreground,
}: {
  label: string;
  emoji: string;
  value: number;
  status: string;
  fill: string;
  foreground: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View testID={`meter-${label.toLowerCase()}`} style={[styles.careTile, { borderColor: foreground }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[styles.careLabel, { color: foreground }]}>{emoji} {label}</Text>
        <Text style={[styles.careLabel, { color: foreground }]}>{pct}</Text>
      </View>
      <View style={[styles.careTrack, { borderColor: foreground }]}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: fill }} />
      </View>
      <Text style={[styles.careStatus, { color: foreground }]} numberOfLines={1}>{status}</Text>
    </View>
  );
}

function ActionTile({
  testID,
  emoji,
  label,
  hint,
  bg,
  fg,
  disabled,
  onPress,
}: {
  testID: string;
  emoji: string;
  label: string;
  hint: string;
  bg: string;
  fg: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionTile, { backgroundColor: bg, borderColor: fg, opacity: disabled ? 0.6 : 1 }]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={styles.actionEmoji}>{emoji}</Text>
        <Text style={[styles.actionText, { color: fg }]}>{label}</Text>
      </View>
      {disabled && hint ? (
        <Text style={[styles.actionHint, { color: fg }]} numberOfLines={1}>{hint}</Text>
      ) : null}
    </Pressable>
  );
}

function BathBubbleLayerRn({ intensity, stroke }: { intensity: number; stroke: string }) {
  const foam = Math.max(0, Math.min(1, intensity));
  const bubbles = [
    { l: "14%", t: "38%", s: 11 },
    { l: "28%", t: "48%", s: 9 },
    { l: "42%", t: "36%", s: 12 },
    { l: "56%", t: "52%", s: 10 },
    { l: "68%", t: "40%", s: 12 },
    { l: "36%", t: "62%", s: 8 },
    { l: "50%", t: "58%", s: 9 },
    { l: "62%", t: "30%", s: 11 },
  ] as const;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bubbles.map((b, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: b.l,
            top: b.t,
            width: b.s,
            height: b.s,
            borderRadius: b.s / 2,
            marginLeft: -b.s / 2,
            marginTop: -b.s / 2,
            backgroundColor: `rgba(255,255,255,${0.38 + foam * 0.48})`,
            borderWidth: 2,
            borderColor: stroke,
            opacity: 0.4 + foam * 0.55,
          }}
        />
      ))}
      {foam > 0.05 ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: 16,
              backgroundColor: `rgba(120, 53, 15, ${foam * 0.26})`,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function BathActivity({
  imageUri,
  backgroundUri,
  showerUri,
  onClose,
  onComplete,
}: {
  imageUri: string;
  backgroundUri: string;
  showerUri: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const colors = useColors();
  const ST = BATH_STAGE_PX;
  const zone = BATH_WASH_ZONE_N;
  const off = BATH_NOZZLE_OFFSET_PX;

  const [hosePx, setHosePx] = useState({ x: ST * 0.78, y: ST * 0.72 });
  const hoseRef = useRef(hosePx);
  useEffect(() => {
    hoseRef.current = hosePx;
  }, [hosePx]);
  const panOriginRef = useRef({ x: ST * 0.78, y: ST * 0.72 });

  const clampHose = useCallback((x: number, y: number) => {
    const nx = Math.max(36, Math.min(ST - 36, x));
    const ny = Math.max(42, Math.min(ST - 40, y));
    hoseRef.current = { x: nx, y: ny };
    setHosePx({ x: nx, y: ny });
  }, [ST]);

  const [washProgress, setWashProgress] = useState(0);
  const washRef = useRef(0);
  const doneRef = useRef(false);
  const finishRef = useRef(onComplete);
  useEffect(() => {
    finishRef.current = onComplete;
  }, [onComplete]);

  const bumpFinish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setTimeout(() => finishRef.current(), 140);
  }, []);

  useEffect(() => {
    washRef.current = washProgress;
  }, [washProgress]);

  useEffect(() => {
    const id = setInterval(() => {
      if (doneRef.current) return;
      const h = hoseRef.current;
      const tipX = (h.x + off.x) / ST;
      const tipY = (h.y + off.y) / ST;
      const rinsing = tipX >= zone.l && tipX <= zone.r && tipY >= zone.t && tipY <= zone.b;
      let next = washRef.current;
      if (rinsing) next = Math.min(100, next + 1.9);
      if (next !== washRef.current) {
        washRef.current = next;
        setWashProgress(next);
      }
      if (next >= 100) bumpFinish();
    }, 26);
    return () => clearInterval(id);
  }, [bumpFinish, ST]);

  const pan = Gesture.Pan()
    .onStart(() => {
      panOriginRef.current = { ...hoseRef.current };
    })
    .onUpdate((e) => {
      runOnJS(clampHose)(
        panOriginRef.current.x + e.translationX,
        panOriginRef.current.y + e.translationY,
      );
    });

  const tipXn = (hosePx.x + off.x) / ST;
  const tipYn = (hosePx.y + off.y) / ST;
  const rinsingNow =
    tipXn >= zone.l &&
    tipXn <= zone.r &&
    tipYn >= zone.t &&
    tipYn <= zone.b;
  const scrubHint =
    washProgress >= 100 ? "All clean!" : rinsingNow ? `${Math.floor(washProgress)}% rinsed` : "Drag shower into dashed zone";

  const foam = Math.max(0, 1 - washProgress / 100);
  const [bgFail, setBgFail] = useState(false);
  const [showerFail, setShowerFail] = useState(false);

  return (
    <View style={[styles.walkOverlay, { backgroundColor: "rgba(0,0,0,0.88)" }]} pointerEvents="auto" testID="bath-overlay">
      <View style={[styles.walkCard, { backgroundColor: colors.card, borderColor: colors.foreground }]}>
        <Pressable testID="bath-cancel" onPress={onClose} style={[styles.walkClose, { borderColor: colors.foreground, backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.walkTitle, { color: colors.foreground }]}>SCRUB TIME!</Text>
        <Text style={[styles.walkHint, { color: colors.foreground, textAlign: "center", paddingHorizontal: 8 }]}>
          Drag the shower through the dashed zone to rinse off the suds
        </Text>
        <View
          style={[styles.bathStage, { width: ST, height: ST, borderColor: colors.foreground, backgroundColor: "#7dd3fc" }]}
        >
          {!bgFail ? (
            <Image
              source={{ uri: backgroundUri }}
              style={[StyleSheet.absoluteFillObject, styles.bathStageImg]}
              resizeMode="cover"
              onError={() => setBgFail(true)}
            />
          ) : null}
          <View style={styles.bathPupWrap} pointerEvents="none">
            <Image source={{ uri: imageUri }} style={{ width: ST * 0.54, height: ST * 0.54 }} resizeMode="contain" />
          </View>
          <View style={[StyleSheet.absoluteFill, { zIndex: 2 }]} pointerEvents="none">
            <BathBubbleLayerRn intensity={foam} stroke={colors.foreground} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.bathZoneOutline,
              {
                borderColor: `rgba(8,145,178,${0.35 + (rinsingNow ? 0.35 : 0)})`,
                left: `${zone.l * 100}%`,
                top: `${zone.t * 100}%`,
                width: `${(zone.r - zone.l) * 100}%`,
                height: `${(zone.b - zone.t) * 100}%`,
              },
            ]}
          />
          <GestureDetector gesture={pan}>
            <Animated.View
              testID="bath-nozzle"
              style={[
                styles.bathNozzle,
                {
                  left: hosePx.x - 28,
                  top: hosePx.y - 32,
                  borderColor: colors.foreground,
                  backgroundColor: colors.card,
                },
              ]}
            >
              {!showerFail ? (
                <Image
                  source={{ uri: showerUri }}
                  style={{ width: 52, height: 56 }}
                  resizeMode="contain"
                  onError={() => setShowerFail(true)}
                />
              ) : (
                <Text style={{ fontSize: 36 }}>🚿</Text>
              )}
            </Animated.View>
          </GestureDetector>
        </View>
        <View style={[styles.walkProgressTrack, { borderColor: colors.foreground, width: ST }]}>
          <View style={{ width: `${washProgress}%`, height: "100%", backgroundColor: "#22d3ee" }} />
        </View>
        <Text style={[styles.walkProgressLabel, { color: colors.foreground }]}>{scrubHint}</Text>
        <View style={styles.walkButtonRow}>
          <Pressable
            testID="bath-cancel-btn"
            onPress={onClose}
            style={[styles.walkBtn, { backgroundColor: colors.card, borderColor: colors.foreground }]}
          >
            <Text style={[styles.actionText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            testID="bath-done"
            onPress={bumpFinish}
            style={[styles.walkBtn, { backgroundColor: "#67e8f9", borderColor: colors.foreground }]}
          >
            <Text style={[styles.actionText, { color: colors.foreground }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function WalkActivity({
  imageUri,
  onClose,
  onComplete,
}: {
  imageUri: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const colors = useColors();
  const TRACK_W = 280;
  const PUP_SIZE = 64;
  const MAX_X = TRACK_W - PUP_SIZE - 16;
  const px = useSharedValue(8);
  const startX = useSharedValue(0);
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setTimeout(onComplete, 100);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onComplete]);

  const updateProgress = (val: number) => {
    const p = Math.max(0, Math.min(100, ((val - 8) / MAX_X) * 100));
    setProgress(p);
    if (p >= 100) {
      setTimeout(onComplete, 200);
    }
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = px.value;
    })
    .onUpdate((e) => {
      const next = Math.max(8, Math.min(MAX_X + 8, startX.value + e.translationX));
      px.value = next;
      runOnJS(updateProgress)(next);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: px.value }],
  }));

  return (
    <View style={[styles.walkOverlay, { backgroundColor: "rgba(0,0,0,0.85)" }]} pointerEvents="box-none">
      <View style={[styles.walkCard, { backgroundColor: colors.card, borderColor: colors.foreground }]}>
        <Pressable testID="walk-cancel" onPress={onClose} style={[styles.walkClose, { borderColor: colors.foreground, backgroundColor: colors.card }]}>
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.walkTitle, { color: colors.foreground }]}>WALKIES!</Text>
        <Text style={[styles.walkHint, { color: colors.foreground }]}>Drag the pup to the flag · {secondsLeft}s left</Text>
        <View style={[styles.walkTrack, { backgroundColor: "#d1fae5", borderColor: colors.foreground, width: TRACK_W }]}>
          <Text style={styles.walkFlag}>🏁</Text>
          <GestureDetector gesture={pan}>
            <Animated.View testID="walk-pup" style={[styles.walkPup, animatedStyle]}>
              <Image source={{ uri: imageUri }} style={{ width: PUP_SIZE, height: PUP_SIZE }} resizeMode="contain" />
            </Animated.View>
          </GestureDetector>
        </View>
        <View style={[styles.walkProgressTrack, { borderColor: colors.foreground, width: TRACK_W }]}>
          <View style={{ width: `${progress}%`, height: "100%", backgroundColor: "#34d399" }} />
        </View>
        <Text style={[styles.walkProgressLabel, { color: colors.foreground }]}>
          {progress >= 100 ? "Good pup!" : `${Math.floor(progress)}% there`}
        </Text>
        <View style={styles.walkButtonRow}>
          <Pressable
            testID="walk-cancel-btn"
            onPress={onClose}
            style={[styles.walkBtn, { backgroundColor: colors.card, borderColor: colors.foreground }]}
          >
            <Text style={[styles.actionText, { color: colors.foreground }]}>Cancel</Text>
          </Pressable>
          <Pressable
            testID="walk-done"
            onPress={onComplete}
            style={[styles.walkBtn, { backgroundColor: "#86efac", borderColor: colors.foreground }]}
          >
            <Text style={[styles.actionText, { color: colors.foreground }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function MeterBar({
  label,
  value,
  fill,
  foreground,
}: {
  label: string;
  value: number;
  fill: string;
  foreground: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={[styles.meterLabel, { color: foreground }]}>{label}</Text>
        <Text style={[styles.meterLabel, { color: foreground }]}>{pct}</Text>
      </View>
      <View style={[styles.meterTrack, { borderColor: foreground }]}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: fill }} />
      </View>
    </View>
  );
}

function DraggableAccessory({
  index,
  placement,
  canvasSize,
  onMove,
  onCommit,
  onRemove,
}: {
  index: number;
  placement: PetAccessoryPlacement;
  canvasSize: { width: number; height: number };
  onMove: (index: number, x: number, y: number) => void;
  onCommit: (index: number, x: number, y: number) => void;
  onRemove: (index: number) => void;
}) {
  const px = useSharedValue(placement.x * canvasSize.width);
  const py = useSharedValue(placement.y * canvasSize.height);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    px.value = placement.x * canvasSize.width;
    py.value = placement.y * canvasSize.height;
  }, [placement.x, placement.y, canvasSize.width, canvasSize.height, px, py]);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = px.value;
      startY.value = py.value;
    })
    .onUpdate((e) => {
      px.value = startX.value + e.translationX;
      py.value = startY.value + e.translationY;
      if (canvasSize.width > 0 && canvasSize.height > 0) {
        runOnJS(onMove)(
          index,
          Math.max(0, Math.min(1, px.value / canvasSize.width)),
          Math.max(0, Math.min(1, py.value / canvasSize.height))
        );
      }
    })
    .onEnd(() => {
      const w = canvasSize.width;
      const h = canvasSize.height;
      const offCanvas = px.value < 0 || py.value < 0 || px.value > w || py.value > h;
      if (offCanvas) {
        runOnJS(onRemove)(index);
        return;
      }
      const nx = Math.max(0, Math.min(1, px.value / w));
      const ny = Math.max(0, Math.min(1, py.value / h));
      px.value = withSpring(nx * w);
      py.value = withSpring(ny * h);
      runOnJS(onCommit)(index, nx, ny);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: px.value - 24 }, { translateY: py.value - 24 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        testID={`placed-${index}`}
        style={[styles.accessory, animatedStyle]}
      >
        <PixelAccessory id={placement.accessoryId} size={44} />
      </Animated.View>
    </GestureDetector>
  );
}

function DraggableTrayItem({
  accessoryId,
  bg,
  border,
  onDrop,
  onTap,
}: {
  accessoryId: string;
  bg: string;
  border: string;
  onDrop: (absX: number, absY: number) => void;
  onTap: () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const dragging = useSharedValue(0);

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)();
  });
  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => {
      dragging.value = 1;
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onDrop)(e.absoluteX, e.absoluteY);
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      dragging.value = 0;
    });
  const composed = Gesture.Exclusive(pan, tap);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging.value ? 1000 : 1,
    opacity: dragging.value ? 0.85 : 1,
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        testID={`tray-${accessoryId}`}
        style={[styles.trayItem, { backgroundColor: bg, borderColor: border }, animated]}
      >
        <PixelAccessory id={accessoryId} size={42} />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 18 },
  title: { fontFamily: "Inter_900Black", fontSize: 44, letterSpacing: -1.5 },
  coinNoticeBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  coinNoticeIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  coinNoticeText: { fontFamily: "Inter_800ExtraBold", fontSize: 13, letterSpacing: 0.3, flex: 1 },
  coinNoticeClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  coinHero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  heroLabel: { fontFamily: "Inter_800ExtraBold", fontSize: 13, letterSpacing: 1.5, marginBottom: 2 },
  heroNumber: { fontFamily: "Inter_900Black", fontSize: 48, letterSpacing: -2, lineHeight: 52 },
  heroChips: { flexDirection: "row", gap: 8, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 2,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontFamily: "Inter_900Black", fontSize: 14 },
  coinBox: { width: 64, height: 64, borderRadius: 18, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  shopCatTabList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 2,
  },
  shopCatTab: {
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 3,
    borderBottomWidth: 0,
  },
  shopCatTabLabel: { fontFamily: "Inter_900Black", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },
  shopPanel: {
    borderWidth: 3,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 14,
    paddingBottom: 18,
    zIndex: 2,
    overflow: "hidden",
  },
  tabRow: { flexDirection: "row", gap: 10 },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
  },
  tabLabel: { fontFamily: "Inter_900Black", fontSize: 14, letterSpacing: 1.2, textTransform: "uppercase" },
  petRow: { flexDirection: "row", padding: 14, gap: 14, alignItems: "center" },
  petImageBox: {
    width: 96,
    height: 96,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  petImage: { width: "100%", height: "100%" },
  miniAccessory: {
    position: "absolute",
    fontSize: 22,
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  miniMood: { position: "absolute", top: 2, right: 4, fontSize: 18 },
  petName: { fontFamily: "Inter_900Black", fontSize: 20, letterSpacing: -0.5 },
  petBreed: { fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 1 },
  petDesc: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 4 },
  priceTag: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 3,
    marginTop: 8,
  },
  priceText: { fontFamily: "Inter_900Black", fontSize: 14 },
  empty: { padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "Inter_900Black", fontSize: 18, marginTop: 4 },
  emptyDesc: { fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
  miniMeterRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  miniMeterTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  miniMeterText: { fontFamily: "Inter_700Bold", fontSize: 10, width: 24, textAlign: "right" },
  tapHint: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.6,
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,20,20,0.6)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 3,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 3,
  },
  modalTitle: { fontFamily: "Inter_900Black", fontSize: 24, letterSpacing: -0.5 },
  modalSubtitle: { fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, opacity: 0.65 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  canvas: {
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 3,
    overflow: "hidden",
    position: "relative",
  },
  canvasImg: { width: "100%", height: "100%" },
  canvasPup: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  moodOverlay: { position: "absolute", top: 8, right: 12, fontSize: 32 },
  rewardPop: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 3,
  },
  rewardText: { fontFamily: "Inter_900Black", fontSize: 16 },
  careGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  careTile: {
    width: "48%",
    padding: 8,
    borderRadius: 12,
    borderWidth: 2.5,
    gap: 4,
  },
  careLabel: { fontFamily: "Inter_900Black", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 },
  careTrack: { height: 8, borderRadius: 4, borderWidth: 1.5, overflow: "hidden" },
  careStatus: { fontFamily: "Inter_700Bold", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionTile: {
    width: "48%",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionHint: { fontFamily: "Inter_700Bold", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.85 },
  waterBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  walkOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  walkCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 360,
  },
  walkClose: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  walkTitle: { fontFamily: "Inter_900Black", fontSize: 24, letterSpacing: -0.5 },
  walkHint: { fontFamily: "Inter_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.7 },
  walkTrack: {
    height: 96,
    borderWidth: 3,
    borderRadius: 16,
    justifyContent: "center",
    overflow: "hidden",
  },
  walkFlag: { position: "absolute", right: 8, fontSize: 28 },
  walkPup: { position: "absolute", top: 16 },
  bathStage: {
    borderRadius: 18,
    borderWidth: 3,
    overflow: "hidden",
    position: "relative",
    alignSelf: "center",
  },
  bathStageImg: {
    opacity: 0.95,
  },
  bathPupWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    paddingBottom: 16,
    zIndex: 1,
  },
  bathZoneOutline: {
    position: "absolute",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 14,
    zIndex: 3,
  },
  bathNozzle: {
    position: "absolute",
    width: 56,
    height: 62,
    zIndex: 5,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  walkProgressTrack: { height: 12, borderRadius: 6, borderWidth: 2.5, overflow: "hidden" },
  walkProgressLabel: { fontFamily: "Inter_900Black", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.8 },
  walkButtonRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  walkBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 3,
  },
  accessory: {
    position: "absolute",
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
  },
  accessoryEmoji: { fontSize: 40, textAlign: "center" },
  meterLabel: { fontFamily: "Inter_900Black", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  meterTrack: { height: 14, borderRadius: 7, borderWidth: 2.5, overflow: "hidden" },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnDisabled: { opacity: 0.45 },
  actionEmoji: { fontSize: 22 },
  actionText: { fontFamily: "Inter_900Black", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.8 },
  trayHeading: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    opacity: 0.7,
  },
  tray: {
    padding: 10,
    borderRadius: 16,
    borderWidth: 3,
    gap: 10,
  },
  trayCategory: { gap: 4 },
  trayCategoryLabel: {
    fontFamily: "Inter_900Black",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    opacity: 0.6,
  },
  trayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  trayItem: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  trayEmoji: { fontSize: 28 },
  clearBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
