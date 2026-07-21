import { Router } from "express";
import { db } from "@workspace/db";
import { financialRateLimit } from "../middlewares/rate-limit";
import {
  walletsTable,
  petsTable,
  userPetsTable,
  petFoodsTable,
  userFoodInventoryTable,
  petToysTable,
  userToysTable,
} from "@workspace/db";
import type {
  PetAccessoryPlacement,
  UserPet,
  Pet,
  PetFood,
  PetToy,
} from "@workspace/db";
import { eq, and, asc, sql, ne } from "drizzle-orm";
import {
  BuyPetParams,
  SetPetAccessoryParams,
  SetPetAccessoryBody,
  SetPetAccessoryLayoutParams,
  SetPetAccessoryLayoutBody,
  RenamePetParams,
  RenamePetBody,
  FeedPetParams,
  WaterPetParams,
  WalkPetParams,
  BathPetParams,
  PlayPetParams,
  BuyFoodParams,
  FeedPetWithParams,
  BuyToyParams,
  PlayPetWithParams,
  TrainPetParams,
} from "@workspace/api-zod";
import { sendZodError } from "../lib/errors";

const router = Router();

export const DEFAULT_WALLET_ID = "default";
export const COINS_PER_COMPLETION = 10;
export const FOOD_PER_COMPLETION = 1;
export const WATER_PER_COMPLETION = 1;

const PET_ART_VERSION = "3";

const DECAY_POINTS_PER_DAY = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STARVATION_LEVEL_DROP_AFTER_MS = MS_PER_DAY;
const WELL_FED_LEVEL_UP_AFTER_MS = MS_PER_DAY;
const FEED_AMOUNT = 35;
const WATER_AMOUNT = 35;
const MAX_LEVEL = 10;
const HAPPY_MIN = 70;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const TRAIN_COOLDOWN_MS = 30 * MINUTE_MS;
const TRAIN_COIN_COST = 5;
const TRICKS_PER_LEVEL = 5;

const VISITOR_COOLDOWN_MS = 6 * HOUR_MS;
const VISITOR_REWARD_COINS = 15;

/** Bonus coins after a completed rewarded placement (client simulates until real ad SDK is wired). */
const AD_WATCH_COINS = 10;
const AD_WATCH_COINS_COOLDOWN_MS = 3 * HOUR_MS;
/** How much playdate wait time one ad shaves off (cannot exceed remaining wait). */
const VISITOR_AD_SKIP_MS = 2 * HOUR_MS;
const VISITOR_AD_SPEEDUP_COOLDOWN_MS = 25 * MINUTE_MS;

type CareActivity = "walk" | "bath" | "play";

const CARE_CONFIG: Record<CareActivity, { decayMs: number; cooldownMs: number; verbPast: string; verbNoun: string; needyVerb: string }> = {
  walk: { decayMs: 4 * HOUR_MS, cooldownMs: 1 * HOUR_MS, verbPast: "Walked", verbNoun: "walk", needyVerb: "Time for a walk" },
  bath: { decayMs: 2 * 24 * HOUR_MS, cooldownMs: 12 * HOUR_MS, verbPast: "Bathed", verbNoun: "bath", needyVerb: "Needs a bath" },
  play: { decayMs: 3 * HOUR_MS, cooldownMs: 30 * MINUTE_MS, verbPast: "Played", verbNoun: "play", needyVerb: "Wants to play" },
};

function meterFromElapsed(elapsedMs: number, decayMs: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - (elapsedMs / decayMs) * 100)));
}

function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / MINUTE_MS));
  if (m < 1) return "moments";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 day" : `${d} days`;
}

function activityLabel(elapsedMs: number, kind: CareActivity): string {
  const cfg = CARE_CONFIG[kind];
  if (elapsedMs < cfg.cooldownMs) {
    return `${formatDuration(cfg.cooldownMs - elapsedMs)} till next ${cfg.verbNoun}`;
  }
  const meter = meterFromElapsed(elapsedMs, cfg.decayMs);
  if (meter <= 0) return cfg.needyVerb;
  return `${cfg.verbPast} ${formatDuration(elapsedMs)} ago`;
}

function activityReady(elapsedMs: number, kind: CareActivity): boolean {
  return elapsedMs >= CARE_CONFIG[kind].cooldownMs;
}

function feedLabel(hunger: number, food: number): string {
  if (hunger >= 100) return "Full";
  if (food <= 0) return "No food — earn from habits";
  if (hunger <= 0) return "Hungry now";
  return `${hunger}% full`;
}

const PET_CATALOG = [
  { slug: "shiba", name: "Toby", breed: "Shiba Inu", description: "A clever little fox-dog with sparkle in his eyes.", price: 50, sortOrder: 1, imageSlug: "shiba" },
  { slug: "corgi", name: "Biscuit", breed: "Corgi", description: "Short legs, big heart. Loves a good wiggle.", price: 80, sortOrder: 2, imageSlug: "corgi" },
  { slug: "frenchie", name: "Coco", breed: "French Bulldog", description: "Bat-eared cuddle bug with serious chill vibes.", price: 120, sortOrder: 3, imageSlug: "frenchie" },
  { slug: "dalmatian", name: "Domino", breed: "Dalmatian", description: "Spotty speed demon. 101 reasons to love them.", price: 160, sortOrder: 4, imageSlug: "dalmatian" },
  { slug: "pomeranian", name: "Mochi", breed: "Pomeranian", description: "A walking marshmallow with main-character energy.", price: 200, sortOrder: 5, imageSlug: "pomeranian" },
  { slug: "golden", name: "Sunny", breed: "Golden Retriever", description: "Pure golden joy. The ultimate goal pup.", price: 300, sortOrder: 6, imageSlug: "golden" },
  { slug: "husky", name: "Aspen", breed: "Husky", description: "Snowy adventurer with piercing icy eyes.", price: 250, sortOrder: 7, imageSlug: "husky" },
  { slug: "beagle", name: "Scout", breed: "Beagle", description: "Nose to the ground, heart on the sleeve.", price: 140, sortOrder: 8, imageSlug: "beagle" },
  { slug: "poodle", name: "Pearl", breed: "Poodle", description: "Fancy curls and a fancier attitude.", price: 220, sortOrder: 9, imageSlug: "poodle" },
  { slug: "labrador", name: "Cooper", breed: "Labrador", description: "Sweet goofball who never says no to fetch.", price: 180, sortOrder: 10, imageSlug: "labrador" },
  { slug: "border-collie", name: "Ziggy", breed: "Border Collie", description: "Genius herder who outsmarts everyone politely.", price: 240, sortOrder: 11, imageSlug: "border-collie" },
  { slug: "dachshund", name: "Noodle", breed: "Dachshund", description: "Brave little hot-dog with zoomies on demand.", price: 110, sortOrder: 12, imageSlug: "dachshund" },
  { slug: "bulldog", name: "Brutus", breed: "Bulldog", description: "Grumpy-soft loaf who melts for snacks.", price: 155, sortOrder: 13, imageSlug: "bulldog" },
  { slug: "boxer", name: "Koda", breed: "Boxer", description: "Wiggle butt zoomies and zero chill.", price: 175, sortOrder: 14, imageSlug: "boxer" },
  { slug: "samoyed", name: "Nimbus", breed: "Samoyed", description: "Polar cloud fluff and permanent smile.", price: 290, sortOrder: 15, imageSlug: "samoyed" },
  { slug: "chihuahua", name: "Pico", breed: "Chihuahua", description: "Tiny thunder with main-character sass.", price: 95, sortOrder: 16, imageSlug: "chihuahua" },
  { slug: "doberman", name: "Raven", breed: "Doberman", description: "Velcro shadow with a heroic streak.", price: 265, sortOrder: 17, imageSlug: "doberman" },
  { slug: "akita", name: "Hoshi", breed: "Akita", description: "Stoic teddy bear guarding your habits.", price: 310, sortOrder: 18, imageSlug: "akita" },
  { slug: "bernese", name: "Zephyr", breed: "Bernese Mountain Dog", description: "Gentle draft pup with paws like pillows.", price: 320, sortOrder: 19, imageSlug: "bernese" },
  { slug: "aussie-shep", name: "Rio", breed: "Australian Shepherd", description: "Merle-coated rocket with herding instincts.", price: 280, sortOrder: 20, imageSlug: "aussie-shep" },
  { slug: "tabby-cat", name: "Sprout", breed: "Orange Tabby", description: "Sunbeam gremlin pretending to nap.", price: 130, sortOrder: 21, imageSlug: "tabby-cat" },
  { slug: "tuxedo-cat", name: "Figaro", breed: "Tuxedo Cat", description: "Dinner-party formal, midnight zoomies chaos.", price: 145, sortOrder: 22, imageSlug: "tuxedo-cat" },
  { slug: "otter", name: "Pebble", breed: "River Otter", description: "Slippery sidekick obsessed with shinies.", price: 235, sortOrder: 23, imageSlug: "otter" },
  { slug: "beaver", name: "Damsel", breed: "North American Beaver", description: "Log-chomping artisan with a velvet tail.", price: 245, sortOrder: 24, imageSlug: "beaver" },
];

const FOOD_CATALOG: Array<{
  slug: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  hungerAmount: number;
  bonusLevel: number;
  sortOrder: number;
}> = [
  { slug: "kibble",  name: "Kibble",  emoji: "🥣", description: "Everyday crunchy basics. Cheap and reliable.", price: 8,  hungerAmount: 25, bonusLevel: 0, sortOrder: 1 },
  { slug: "treat",   name: "Treat",   emoji: "🍖", description: "Tasty mid-tier reward. Pups love it.",         price: 20, hungerAmount: 50, bonusLevel: 0, sortOrder: 2 },
  { slug: "premium", name: "Premium", emoji: "🍱", description: "Gourmet meal — fills tummy and bumps a level.", price: 45, hungerAmount: 90, bonusLevel: 1, sortOrder: 3 },
];

const TOY_CATALOG: Array<{
  slug: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  happinessGain: number;
  cooldownMinutes: number;
  sortOrder: number;
}> = [
  { slug: "ball",      name: "Squeaky Ball", emoji: "⚽", description: "Classic chase-and-fetch fun.",         price: 25,  happinessGain: 30, cooldownMinutes: 30,  sortOrder: 1 },
  { slug: "rope",      name: "Tug Rope",     emoji: "🪢", description: "Tug-of-war keeps muscles strong.",     price: 35,  happinessGain: 40, cooldownMinutes: 45,  sortOrder: 2 },
  { slug: "frisbee",   name: "Frisbee",      emoji: "🥏", description: "Long-distance leaping joy.",           price: 50,  happinessGain: 50, cooldownMinutes: 60,  sortOrder: 3 },
  { slug: "plush",     name: "Plush Toy",    emoji: "🧸", description: "Cuddly nap buddy.",                    price: 40,  happinessGain: 35, cooldownMinutes: 60,  sortOrder: 4 },
  { slug: "puzzle",    name: "Puzzle Cube",  emoji: "🧩", description: "Brain-teaser. Levels up smart pups.",  price: 80,  happinessGain: 60, cooldownMinutes: 120, sortOrder: 5 },
];

const VISITOR_NAMES = ["Buddy", "Luna", "Rocky", "Daisy", "Max", "Zoe", "Milo", "Bella", "Charlie", "Ruby"];

export async function ensureSeed(): Promise<void> {
  await db
    .insert(walletsTable)
    .values({ id: DEFAULT_WALLET_ID, coins: 0 })
    .onConflictDoNothing();
  for (const p of PET_CATALOG) {
    const imagePath = `/api/assets/pets/${p.imageSlug}.png?v=${PET_ART_VERSION}`;
    await db
      .insert(petsTable)
      .values({
        slug: p.slug,
        name: p.name,
        breed: p.breed,
        description: p.description,
        price: p.price,
        imagePath,
        sortOrder: p.sortOrder,
      })
      .onConflictDoUpdate({
        target: petsTable.slug,
        set: {
          name: p.name,
          breed: p.breed,
          description: p.description,
          price: p.price,
          imagePath,
          sortOrder: p.sortOrder,
        },
      });
  }
  for (const f of FOOD_CATALOG) {
    await db
      .insert(petFoodsTable)
      .values(f)
      .onConflictDoUpdate({
        target: petFoodsTable.slug,
        set: { name: f.name, emoji: f.emoji, description: f.description, price: f.price, hungerAmount: f.hungerAmount, bonusLevel: f.bonusLevel, sortOrder: f.sortOrder },
      });
  }
  for (const t of TOY_CATALOG) {
    await db
      .insert(petToysTable)
      .values(t)
      .onConflictDoUpdate({
        target: petToysTable.slug,
        set: { name: t.name, emoji: t.emoji, description: t.description, price: t.price, happinessGain: t.happinessGain, cooldownMinutes: t.cooldownMinutes, sortOrder: t.sortOrder },
      });
  }
}

export async function getWallet(walletId: string): Promise<{ coins: number; food: number; water: number }> {
  const [w] = await db.select().from(walletsTable).where(eq(walletsTable.id, walletId));
  if (!w) {
    await db
      .insert(walletsTable)
      .values({ id: walletId, coins: 0, food: 0, water: 0 })
      .onConflictDoNothing();
    return { coins: 0, food: 0, water: 0 };
  }
  return { coins: w.coins, food: w.food, water: w.water };
}

export async function awardCoins(walletId: string, amount: number): Promise<{ coins: number; food: number; water: number }> {
  await db
    .insert(walletsTable)
    .values({ id: walletId, coins: amount })
    .onConflictDoUpdate({
      target: walletsTable.id,
      set: {
        coins: sql`${walletsTable.coins} + ${amount}`,
        updatedAt: new Date(),
      },
    });
  return getWallet(walletId);
}

export async function awardFoodAndWater(
  walletId: string,
  food: number,
  water: number
): Promise<{ coins: number; food: number; water: number }> {
  await db
    .insert(walletsTable)
    .values({ id: walletId, coins: 0, food, water })
    .onConflictDoUpdate({
      target: walletsTable.id,
      set: {
        food: sql`${walletsTable.food} + ${food}`,
        water: sql`${walletsTable.water} + ${water}`,
        updatedAt: new Date(),
      },
    });
  return getWallet(walletId);
}

type Mood = "happy" | "content" | "hungry" | "thirsty" | "sad";

function moodFor(
  hunger: number,
  thirst: number,
  walk = 100,
  bath = 100,
  play = 100,
): Mood {
  if (hunger <= 0 && thirst <= 0) return "sad";
  if (hunger <= 0) return "hungry";
  if (thirst <= 0) return "thirsty";
  if (walk <= 0 || bath <= 0 || play <= 0) return "sad";
  if (
    hunger >= HAPPY_MIN &&
    thirst >= HAPPY_MIN &&
    walk >= HAPPY_MIN &&
    bath >= HAPPY_MIN &&
    play >= HAPPY_MIN
  )
    return "happy";
  return "content";
}

function ensureLayout(pet: UserPet): PetAccessoryPlacement[] {
  if (Array.isArray(pet.accessoryLayout) && pet.accessoryLayout.length > 0) {
    return pet.accessoryLayout;
  }
  if (pet.accessory) {
    return [{ accessoryId: pet.accessory, x: 0.5, y: 0.18 }];
  }
  return [];
}

type DecaySnapshot = {
  hunger: number;
  thirst: number;
  level: number;
  hungerZeroSince: Date | null;
  thirstZeroSince: Date | null;
  wellFedSince: Date | null;
  meterChanged: boolean;
  zeroSinceChanged: boolean;
  wellFedChanged: boolean;
  backfilledLayout: PetAccessoryPlacement[] | null;
};

function trackZero(
  oldMeter: number,
  newMeter: number,
  oldZeroSince: Date | null,
  now: Date,
  msPerPoint: number,
  elapsedMs: number,
): { zeroSince: Date | null; drops: number } {
  if (newMeter > 0) return { zeroSince: null, drops: 0 };
  let zeroSinceMs: number;
  if (oldZeroSince) {
    zeroSinceMs = oldZeroSince.getTime();
  } else if (oldMeter <= 0) {
    zeroSinceMs = now.getTime();
  } else {
    const msUntilZero = oldMeter * msPerPoint;
    zeroSinceMs = now.getTime() - Math.max(0, elapsedMs - msUntilZero);
  }
  const timeAtZero = now.getTime() - zeroSinceMs;
  const drops = Math.max(0, Math.floor(timeAtZero / STARVATION_LEVEL_DROP_AFTER_MS));
  const advancedZeroSince = new Date(zeroSinceMs + drops * STARVATION_LEVEL_DROP_AFTER_MS);
  return { zeroSince: advancedZeroSince, drops };
}

function trackWellFed(
  oldHunger: number,
  oldThirst: number,
  newHunger: number,
  newThirst: number,
  oldWellFedSince: Date | null,
  now: Date,
  msPerPoint: number,
  elapsedMs: number,
): { wellFedSince: Date | null; gains: number } {
  const stillWellFed = newHunger >= HAPPY_MIN && newThirst >= HAPPY_MIN;
  if (!stillWellFed) return { wellFedSince: null, gains: 0 };
  let sinceMs: number;
  if (oldWellFedSince) {
    sinceMs = oldWellFedSince.getTime();
  } else {
    const msUntilDropH = Math.max(0, (oldHunger - HAPPY_MIN) * msPerPoint);
    const msUntilDropT = Math.max(0, (oldThirst - HAPPY_MIN) * msPerPoint);
    const wereWellFed = oldHunger >= HAPPY_MIN && oldThirst >= HAPPY_MIN;
    sinceMs = wereWellFed
      ? now.getTime() - elapsedMs
      : now.getTime() - Math.max(0, elapsedMs - Math.min(msUntilDropH, msUntilDropT));
  }
  const timeWellFed = now.getTime() - sinceMs;
  const gains = Math.max(0, Math.floor(timeWellFed / WELL_FED_LEVEL_UP_AFTER_MS));
  const advancedSince = new Date(sinceMs + gains * WELL_FED_LEVEL_UP_AFTER_MS);
  return { wellFedSince: advancedSince, gains };
}

function computeDecay(pet: UserPet, now: Date): DecaySnapshot {
  const elapsedMs = Math.max(0, now.getTime() - new Date(pet.lastDecayAt).getTime());
  const decayPoints = (elapsedMs / MS_PER_DAY) * DECAY_POINTS_PER_DAY;
  const msPerPoint = MS_PER_DAY / DECAY_POINTS_PER_DAY;

  const newHunger = Math.max(0, Math.round(pet.hunger - decayPoints));
  const newThirst = Math.max(0, Math.round(pet.thirst - decayPoints));

  const h = trackZero(pet.hunger, newHunger, pet.hungerZeroSince, now, msPerPoint, elapsedMs);
  const t = trackZero(pet.thirst, newThirst, pet.thirstZeroSince, now, msPerPoint, elapsedMs);
  const wf = trackWellFed(
    pet.hunger,
    pet.thirst,
    newHunger,
    newThirst,
    pet.wellFedSince,
    now,
    msPerPoint,
    elapsedMs,
  );
  const newLevel = Math.min(
    MAX_LEVEL,
    Math.max(1, pet.level - h.drops - t.drops + wf.gains),
  );

  const needsBackfill =
    pet.accessoryLayout.length === 0 && pet.accessory != null && pet.accessory.length > 0;
  const backfilledLayout: PetAccessoryPlacement[] | null = needsBackfill
    ? [{ accessoryId: pet.accessory as string, x: 0.5, y: 0.18 }]
    : null;

  const meterChanged =
    newHunger !== pet.hunger || newThirst !== pet.thirst || newLevel !== pet.level;
  const zeroSinceChanged =
    (h.zeroSince?.getTime() ?? null) !== (pet.hungerZeroSince?.getTime() ?? null) ||
    (t.zeroSince?.getTime() ?? null) !== (pet.thirstZeroSince?.getTime() ?? null);
  const wellFedChanged =
    (wf.wellFedSince?.getTime() ?? null) !== (pet.wellFedSince?.getTime() ?? null);

  return {
    hunger: newHunger,
    thirst: newThirst,
    level: newLevel,
    hungerZeroSince: h.zeroSince,
    thirstZeroSince: t.zeroSince,
    wellFedSince: wf.wellFedSince,
    meterChanged,
    zeroSinceChanged,
    wellFedChanged,
    backfilledLayout,
  };
}

async function decayPetRow(pet: UserPet): Promise<UserPet> {
  const now = new Date();
  const snap = computeDecay(pet, now);
  if (
    !snap.meterChanged &&
    !snap.zeroSinceChanged &&
    !snap.wellFedChanged &&
    !snap.backfilledLayout
  )
    return pet;

  const setClause: Partial<typeof userPetsTable.$inferInsert> = {};
  if (snap.meterChanged) {
    setClause.hunger = snap.hunger;
    setClause.thirst = snap.thirst;
    setClause.level = snap.level;
    setClause.lastDecayAt = now;
  }
  if (snap.zeroSinceChanged) {
    setClause.hungerZeroSince = snap.hungerZeroSince;
    setClause.thirstZeroSince = snap.thirstZeroSince;
  }
  if (snap.wellFedChanged) setClause.wellFedSince = snap.wellFedSince;
  if (snap.backfilledLayout) setClause.accessoryLayout = snap.backfilledLayout;

  const [updated] = await db
    .update(userPetsTable)
    .set(setClause)
    .where(eq(userPetsTable.id, pet.id))
    .returning();
  return updated ?? pet;
}

function petDisplayName(pet: UserPet, catalog: Pet): string {
  return pet.nickname && pet.nickname.trim().length > 0 ? pet.nickname : catalog.name;
}

function toOwnedPetDto(pet: UserPet, catalog: Pet, foodInventory = 0) {
  const layout = ensureLayout(pet);
  const now = Date.now();
  const walkElapsed = now - new Date(pet.lastWalkAt).getTime();
  const bathElapsed = now - new Date(pet.lastBathAt).getTime();
  const playElapsed = now - new Date(pet.lastPlayAt).getTime();
  const trainElapsed = now - new Date(pet.lastTrainAt).getTime();
  const walk = meterFromElapsed(walkElapsed, CARE_CONFIG.walk.decayMs);
  const bath = meterFromElapsed(bathElapsed, CARE_CONFIG.bath.decayMs);
  const play = meterFromElapsed(playElapsed, CARE_CONFIG.play.decayMs);
  const trainReady = trainElapsed >= TRAIN_COOLDOWN_MS;
  const trainLabel = trainReady
    ? pet.tricksLearned === 0
      ? "Ready to learn"
      : `Knows ${pet.tricksLearned} trick${pet.tricksLearned === 1 ? "" : "s"}`
    : `${formatDuration(TRAIN_COOLDOWN_MS - trainElapsed)} till next session`;
  return {
    id: pet.id,
    slug: catalog.slug,
    name: petDisplayName(pet, catalog),
    breed: catalog.breed,
    imageUrl: catalog.imagePath,
    nickname: pet.nickname,
    accessory: pet.accessory ?? null,
    accessoryLayout: layout,
    hunger: pet.hunger,
    thirst: pet.thirst,
    walk,
    bath,
    play,
    feedLabel: feedLabel(pet.hunger, foodInventory),
    walkLabel: activityLabel(walkElapsed, "walk"),
    bathLabel: activityLabel(bathElapsed, "bath"),
    playLabel: activityLabel(playElapsed, "play"),
    feedReady: pet.hunger < 100 && foodInventory > 0,
    walkReady: activityReady(walkElapsed, "walk"),
    bathReady: activityReady(bathElapsed, "bath"),
    playReady: activityReady(playElapsed, "play"),
    level: pet.level,
    tricksLearned: pet.tricksLearned,
    trainReady,
    trainLabel,
    mood: moodFor(pet.hunger, pet.thirst, walk, bath, play),
    acquiredAt: pet.acquiredAt.toISOString(),
  };
}

router.get("/wallet", async (req, res) => {
  const walletId = req.walletId;
  try {
    res.json(await getWallet(walletId));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/shop", async (req, res) => {
  const walletId = req.walletId;
  try {
    const pets = await db.select().from(petsTable).orderBy(asc(petsTable.sortOrder));
    const owned = await db
      .select({ slug: userPetsTable.petSlug })
      .from(userPetsTable)
      .where(eq(userPetsTable.walletId, walletId));
    const ownedSet = new Set(owned.map((o) => o.slug));
    res.json(
      pets.map((p) => ({
        slug: p.slug,
        name: p.name,
        breed: p.breed,
        description: p.description,
        price: p.price,
        imageUrl: p.imagePath,
        owned: ownedSet.has(p.slug),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/shop/buy/:slug", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = BuyPetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const slug = paramsParsed.data.slug;
  try {
    const [pet] = await db.select().from(petsTable).where(eq(petsTable.slug, slug));
    if (!pet) {
      res.status(404).json({ error: "Pet not found" });
      return;
    }

    type BuyResult =
      | { kind: "ok"; ownedRow: UserPet; coins: number }
      | { kind: "already_owned" }
      | { kind: "insufficient"; need: number };

    const result = await db.transaction(async (tx): Promise<BuyResult> => {
      const [existingOwned] = await tx
        .select({ id: userPetsTable.id })
        .from(userPetsTable)
        .where(and(eq(userPetsTable.walletId, walletId), eq(userPetsTable.petSlug, slug)));
      if (existingOwned) return { kind: "already_owned" };

      const debited = await tx
        .update(walletsTable)
        .set({
          coins: sql`${walletsTable.coins} - ${pet.price}`,
          updatedAt: new Date(),
        })
        .where(
          and(eq(walletsTable.id, walletId), sql`${walletsTable.coins} >= ${pet.price}`)
        )
        .returning({ coins: walletsTable.coins });

      if (debited.length === 0) {
        const [w] = await tx.select().from(walletsTable).where(eq(walletsTable.id, walletId));
        return { kind: "insufficient", need: pet.price - (w?.coins ?? 0) };
      }

      const owned = await tx
        .insert(userPetsTable)
        .values({ walletId: walletId, petSlug: slug })
        .onConflictDoNothing({ target: [userPetsTable.walletId, userPetsTable.petSlug] })
        .returning();

      if (owned.length === 0) {
        await tx
          .update(walletsTable)
          .set({
            coins: sql`${walletsTable.coins} + ${pet.price}`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.id, walletId));
        return { kind: "already_owned" };
      }

      return {
        kind: "ok",
        ownedRow: owned[0],
        coins: debited[0].coins,
      };
    });

    if (result.kind === "already_owned") {
      res.status(400).json({ error: "You already own this pet" });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(400).json({ error: `Need ${result.need} more coins` });
      return;
    }
    const wallet = await getWallet(walletId);
    res.status(201).json({
      pet: toOwnedPetDto(result.ownedRow, pet, wallet.food),
      wallet,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to buy pet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collection/:id", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = SetPetAccessoryParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  try {
    const row = await loadOwnedWithCatalog(walletId, id);
    if (!row) {
      res.status(404).json({ error: "Owned pet not found" });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json(toOwnedPetDto(await decayPetRow(row.pet), row.catalog, wallet.food));
  } catch (err) {
    req.log.error({ err }, "Failed to load owned pet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/collection", async (req, res) => {
  const walletId = req.walletId;
  try {
    const rows = await db
      .select({ pet: userPetsTable, catalog: petsTable })
      .from(userPetsTable)
      .innerJoin(petsTable, eq(userPetsTable.petSlug, petsTable.slug))
      .where(eq(userPetsTable.walletId, walletId))
      .orderBy(asc(petsTable.sortOrder));
    const decayed = await Promise.all(
      rows.map(async (r) => ({ pet: await decayPetRow(r.pet), catalog: r.catalog }))
    );
    const wallet = await getWallet(walletId);
    res.json(decayed.map(({ pet, catalog }) => toOwnedPetDto(pet, catalog, wallet.food)));
  } catch (err) {
    req.log.error({ err }, "Failed to load collection");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function loadOwnedWithCatalog(walletId: string, id: number): Promise<{ pet: UserPet; catalog: Pet } | null> {
  const [row] = await db
    .select({ pet: userPetsTable, catalog: petsTable })
    .from(userPetsTable)
    .innerJoin(petsTable, eq(userPetsTable.petSlug, petsTable.slug))
    .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)));
  if (!row) return null;
  return row;
}

router.put("/collection/:id/accessory", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = SetPetAccessoryParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  const bodyParsed = SetPetAccessoryBody.safeParse(req.body);
  if (!bodyParsed.success) {
    sendZodError(res, bodyParsed.error);
    return;
  }
  const accessory = bodyParsed.data.accessory;
  try {
    const layout: PetAccessoryPlacement[] = accessory
      ? [{ accessoryId: accessory, x: 0.5, y: 0.18 }]
      : [];
    const [owned] = await db
      .update(userPetsTable)
      .set({ accessory, accessoryLayout: layout })
      .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
      .returning();
    if (!owned) {
      res.status(404).json({ error: "Owned pet not found" });
      return;
    }
    const [catalog] = await db.select().from(petsTable).where(eq(petsTable.slug, owned.petSlug));
    const wallet = await getWallet(walletId);
    res.json(toOwnedPetDto(await decayPetRow(owned), catalog, wallet.food));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/collection/:id/name", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = RenamePetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  const bodyParsed = RenamePetBody.safeParse(req.body);
  if (!bodyParsed.success) {
    sendZodError(res, bodyParsed.error);
    return;
  }
  const trimmed = bodyParsed.data.name.trim();
  try {
    const [owned] = await db
      .update(userPetsTable)
      .set({ nickname: trimmed })
      .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
      .returning();
    if (!owned) {
      res.status(404).json({ error: "Owned pet not found" });
      return;
    }
    const [catalog] = await db.select().from(petsTable).where(eq(petsTable.slug, owned.petSlug));
    const wallet = await getWallet(walletId);
    res.json(toOwnedPetDto(await decayPetRow(owned), catalog, wallet.food));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/collection/:id/layout", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = SetPetAccessoryLayoutParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  const bodyParsed = SetPetAccessoryLayoutBody.safeParse(req.body);
  if (!bodyParsed.success) {
    sendZodError(res, bodyParsed.error);
    return;
  }
  const layout: PetAccessoryPlacement[] = bodyParsed.data.accessoryLayout.map((item) => ({
    accessoryId: item.accessoryId,
    x: Math.max(0, Math.min(1, item.x)),
    y: Math.max(0, Math.min(1, item.y)),
  }));
  try {
    const [owned] = await db
      .update(userPetsTable)
      .set({
        accessoryLayout: layout,
        accessory: layout[0]?.accessoryId ?? null,
      })
      .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
      .returning();
    if (!owned) {
      res.status(404).json({ error: "Owned pet not found" });
      return;
    }
    const [catalog] = await db.select().from(petsTable).where(eq(petsTable.slug, owned.petSlug));
    const wallet = await getWallet(walletId);
    res.json(toOwnedPetDto(await decayPetRow(owned), catalog, wallet.food));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

type CareKind = "feed" | "water";

async function performCareAction(
  walletId: string,
  petId: number,
  kind: CareKind
): Promise<
  | { ok: true; pet: UserPet; catalog: Pet }
  | { ok: false; status: number; error: string }
> {
  return db.transaction(async (tx) => {
    const [petRow] = await tx
      .select()
      .from(userPetsTable)
      .where(
        and(eq(userPetsTable.id, petId), eq(userPetsTable.walletId, walletId))
      )
      .for("update");
    if (!petRow) {
      return { ok: false as const, status: 404, error: "Owned pet not found" };
    }
    const [catalog] = await tx
      .select()
      .from(petsTable)
      .where(eq(petsTable.slug, petRow.petSlug));
    if (!catalog) {
      return { ok: false as const, status: 500, error: "Pet catalog missing" };
    }

    const now = new Date();
    const snap = computeDecay(petRow, now);
    const decayedHunger = snap.hunger;
    const decayedThirst = snap.thirst;
    const decayedLevel = snap.level;

    if (kind === "feed" && decayedHunger >= 100) {
      return { ok: false as const, status: 400, error: `${petDisplayName(petRow, catalog)} isn't hungry right now` };
    }
    if (kind === "water" && decayedThirst >= 100) {
      return { ok: false as const, status: 400, error: `${petDisplayName(petRow, catalog)} isn't thirsty right now` };
    }

    const debitColumn = kind === "feed" ? walletsTable.food : walletsTable.water;
    const debited = await tx
      .update(walletsTable)
      .set({
        ...(kind === "feed"
          ? { food: sql`${walletsTable.food} - 1` }
          : { water: sql`${walletsTable.water} - 1` }),
        updatedAt: now,
      })
      .where(and(eq(walletsTable.id, walletId), sql`${debitColumn} >= 1`))
      .returning({ food: walletsTable.food, water: walletsTable.water });
    if (debited.length === 0) {
      return {
        ok: false as const,
        status: 400,
        error: kind === "feed" ? "No food in inventory" : "No water in inventory",
      };
    }

    const newHunger =
      kind === "feed" ? Math.min(100, decayedHunger + FEED_AMOUNT) : decayedHunger;
    const newThirst =
      kind === "water" ? Math.min(100, decayedThirst + WATER_AMOUNT) : decayedThirst;
    const nowWellFed = newHunger >= HAPPY_MIN && newThirst >= HAPPY_MIN;
    const wasWellFed = decayedHunger >= HAPPY_MIN && decayedThirst >= HAPPY_MIN;
    const newWellFedSince = nowWellFed
      ? wasWellFed
        ? snap.wellFedSince ?? now
        : now
      : null;

    const [updated] = await tx
      .update(userPetsTable)
      .set({
        hunger: newHunger,
        thirst: newThirst,
        level: decayedLevel,
        lastDecayAt: now,
        hungerZeroSince: newHunger > 0 ? null : snap.hungerZeroSince,
        thirstZeroSince: newThirst > 0 ? null : snap.thirstZeroSince,
        wellFedSince: newWellFedSince,
      })
      .where(eq(userPetsTable.id, petId))
      .returning();

    return { ok: true as const, pet: updated, catalog };
  });
}

router.post("/collection/:id/feed", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = FeedPetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  try {
    const result = await performCareAction(walletId, id, "feed");
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({ pet: toOwnedPetDto(result.pet, result.catalog, wallet.food), wallet });
  } catch (err) {
    req.log.error({ err }, "Failed to feed pet");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collection/:id/water", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = WaterPetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  try {
    const result = await performCareAction(walletId, id, "water");
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({ pet: toOwnedPetDto(result.pet, result.catalog, wallet.food), wallet });
  } catch (err) {
    req.log.error({ err }, "Failed to water pet");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function performActivityAction(
  walletId: string,
  petId: number,
  kind: CareActivity,
): Promise<
  | { ok: true; pet: UserPet; catalog: Pet }
  | { ok: false; status: number; error: string }
> {
  return db.transaction(async (tx) => {
    const [petRow] = await tx
      .select()
      .from(userPetsTable)
      .where(and(eq(userPetsTable.id, petId), eq(userPetsTable.walletId, walletId)))
      .for("update");
    if (!petRow) return { ok: false as const, status: 404, error: "Owned pet not found" };
    const [catalog] = await tx.select().from(petsTable).where(eq(petsTable.slug, petRow.petSlug));
    if (!catalog) return { ok: false as const, status: 500, error: "Pet catalog missing" };

    const now = new Date();
    const lastAt =
      kind === "walk" ? petRow.lastWalkAt : kind === "bath" ? petRow.lastBathAt : petRow.lastPlayAt;
    const elapsed = now.getTime() - new Date(lastAt).getTime();
    const cfg = CARE_CONFIG[kind];
    if (elapsed < cfg.cooldownMs) {
      return {
        ok: false as const,
        status: 400,
        error: `${formatDuration(cfg.cooldownMs - elapsed)} till next ${cfg.verbNoun}`,
      };
    }

    const setClause: Partial<typeof userPetsTable.$inferInsert> = {};
    if (kind === "walk") setClause.lastWalkAt = now;
    if (kind === "bath") setClause.lastBathAt = now;
    if (kind === "play") setClause.lastPlayAt = now;

    const [updated] = await tx
      .update(userPetsTable)
      .set(setClause)
      .where(eq(userPetsTable.id, petId))
      .returning();
    return { ok: true as const, pet: updated, catalog };
  });
}

const ACTIVITY_SCHEMAS = {
  walk: WalkPetParams,
  bath: BathPetParams,
  play: PlayPetParams,
} as const;

function makeActivityRoute(kind: CareActivity) {
  return async (req: import("express").Request, res: import("express").Response) => {
    const walletId = req.walletId;
    const paramsParsed = ACTIVITY_SCHEMAS[kind].safeParse(req.params);
    if (!paramsParsed.success) {
      sendZodError(res, paramsParsed.error);
      return;
    }
    const id = paramsParsed.data.id;
    try {
      const result = await performActivityAction(walletId, id, kind);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const wallet = await getWallet(walletId);
      res.json({ pet: toOwnedPetDto(result.pet, result.catalog, wallet.food), wallet });
    } catch (err) {
      req.log.error({ err }, `Failed to ${kind} pet`);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

router.post("/collection/:id/walk", makeActivityRoute("walk"));
router.post("/collection/:id/bath", makeActivityRoute("bath"));
router.post("/collection/:id/play", makeActivityRoute("play"));

// ---------------------------------------------------------------------------
// FOOD: catalog, owned inventory, buy, feed-with
// ---------------------------------------------------------------------------

async function getFoodInventoryMap(walletId: string): Promise<Record<string, number>> {
  const rows = await db
    .select()
    .from(userFoodInventoryTable)
    .where(eq(userFoodInventoryTable.walletId, walletId));
  const map: Record<string, number> = {};
  for (const r of rows) map[r.foodSlug] = r.quantity;
  return map;
}

router.get("/foods", async (req, res) => {
  const walletId = req.walletId;
  try {
    const foods = await db.select().from(petFoodsTable).orderBy(asc(petFoodsTable.sortOrder));
    const owned = await getFoodInventoryMap(walletId);
    res.json(
      foods.map((f) => ({
        slug: f.slug,
        name: f.name,
        emoji: f.emoji,
        description: f.description,
        price: f.price,
        hungerAmount: f.hungerAmount,
        bonusLevel: f.bonusLevel,
        owned: owned[f.slug] ?? 0,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/foods/buy/:slug", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = BuyFoodParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const slug = paramsParsed.data.slug;
  try {
    const [food] = await db.select().from(petFoodsTable).where(eq(petFoodsTable.slug, slug));
    if (!food) {
      res.status(404).json({ error: "Food not found" });
      return;
    }
    type R = { kind: "ok" } | { kind: "insufficient"; need: number };
    const result = await db.transaction(async (tx): Promise<R> => {
      const debited = await tx
        .update(walletsTable)
        .set({ coins: sql`${walletsTable.coins} - ${food.price}`, updatedAt: new Date() })
        .where(and(eq(walletsTable.id, walletId), sql`${walletsTable.coins} >= ${food.price}`))
        .returning({ coins: walletsTable.coins });
      if (debited.length === 0) {
        const [w] = await tx.select().from(walletsTable).where(eq(walletsTable.id, walletId));
        return { kind: "insufficient", need: food.price - (w?.coins ?? 0) };
      }
      await tx
        .insert(userFoodInventoryTable)
        .values({ walletId: walletId, foodSlug: slug, quantity: 1 })
        .onConflictDoUpdate({
          target: [userFoodInventoryTable.walletId, userFoodInventoryTable.foodSlug],
          set: { quantity: sql`${userFoodInventoryTable.quantity} + 1` },
        });
      return { kind: "ok" };
    });
    if (result.kind === "insufficient") {
      res.status(400).json({ error: `Need ${result.need} more coins` });
      return;
    }
    const wallet = await getWallet(walletId);
    const owned = await getFoodInventoryMap(walletId);
    res.json({ wallet, owned: owned[slug] ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to buy food");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collection/:id/feed-with/:foodSlug", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = FeedPetWithParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  const foodSlug = paramsParsed.data.foodSlug;
  try {
    type R =
      | { kind: "ok"; pet: UserPet; catalog: Pet; food: PetFood }
      | { kind: "err"; status: number; error: string };
    const result: R = await db.transaction(async (tx): Promise<R> => {
      const [food] = await tx.select().from(petFoodsTable).where(eq(petFoodsTable.slug, foodSlug));
      if (!food) return { kind: "err", status: 404, error: "Food not found" };
      const [petRow] = await tx
        .select()
        .from(userPetsTable)
        .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
        .for("update");
      if (!petRow) return { kind: "err", status: 404, error: "Owned pet not found" };
      const [catalog] = await tx.select().from(petsTable).where(eq(petsTable.slug, petRow.petSlug));
      if (!catalog) return { kind: "err", status: 500, error: "Pet catalog missing" };

      const now = new Date();
      const snap = computeDecay(petRow, now);
      if (snap.hunger >= 100) {
        return { kind: "err", status: 400, error: `${petDisplayName(petRow, catalog)} isn't hungry right now` };
      }
      const debited = await tx
        .update(userFoodInventoryTable)
        .set({ quantity: sql`${userFoodInventoryTable.quantity} - 1` })
        .where(
          and(
            eq(userFoodInventoryTable.walletId, walletId),
            eq(userFoodInventoryTable.foodSlug, foodSlug),
            sql`${userFoodInventoryTable.quantity} >= 1`
          )
        )
        .returning({ quantity: userFoodInventoryTable.quantity });
      if (debited.length === 0) {
        return { kind: "err", status: 400, error: `No ${food.name.toLowerCase()} in pantry` };
      }

      const newHunger = Math.min(100, snap.hunger + food.hungerAmount);
      const nowWellFed = newHunger >= HAPPY_MIN && snap.thirst >= HAPPY_MIN;
      const wasWellFed = snap.hunger >= HAPPY_MIN && snap.thirst >= HAPPY_MIN;
      const newWellFedSince = nowWellFed
        ? wasWellFed
          ? snap.wellFedSince ?? now
          : now
        : null;
      const newLevel = Math.min(MAX_LEVEL, snap.level + (food.bonusLevel ?? 0));
      const [updated] = await tx
        .update(userPetsTable)
        .set({
          hunger: newHunger,
          thirst: snap.thirst,
          level: newLevel,
          lastDecayAt: now,
          hungerZeroSince: newHunger > 0 ? null : snap.hungerZeroSince,
          thirstZeroSince: snap.thirstZeroSince,
          wellFedSince: newWellFedSince,
        })
        .where(eq(userPetsTable.id, id))
        .returning();
      return { kind: "ok", pet: updated, catalog, food };
    });
    if (result.kind === "err") {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({ pet: toOwnedPetDto(result.pet, result.catalog, wallet.food), wallet });
  } catch (err) {
    req.log.error({ err }, "Failed to feed-with");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// TOYS: catalog, owned, buy, play-with
// ---------------------------------------------------------------------------

router.get("/toys", async (req, res) => {
  const walletId = req.walletId;
  try {
    const toys = await db.select().from(petToysTable).orderBy(asc(petToysTable.sortOrder));
    const owned = await db
      .select()
      .from(userToysTable)
      .where(eq(userToysTable.walletId, walletId));
    const ownedMap = new Map(owned.map((t) => [t.toySlug, t.lastUsedAt]));
    const now = Date.now();
    res.json(
      toys.map((t) => {
        const isOwned = ownedMap.has(t.slug);
        const lastUsed = ownedMap.get(t.slug);
        const cdMs = t.cooldownMinutes * MINUTE_MS;
        const elapsed = lastUsed ? now - new Date(lastUsed).getTime() : cdMs;
        const ready = elapsed >= cdMs;
        const cooldownLabel = ready
          ? "Ready to play"
          : `${formatDuration(cdMs - elapsed)} till ready`;
        return {
          slug: t.slug,
          name: t.name,
          emoji: t.emoji,
          description: t.description,
          price: t.price,
          happinessGain: t.happinessGain,
          cooldownMinutes: t.cooldownMinutes,
          owned: isOwned,
          ready: isOwned && ready,
          cooldownLabel: isOwned ? cooldownLabel : `${t.price} coins`,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/toys/buy/:slug", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = BuyToyParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const slug = paramsParsed.data.slug;
  try {
    const [toy] = await db.select().from(petToysTable).where(eq(petToysTable.slug, slug));
    if (!toy) {
      res.status(404).json({ error: "Toy not found" });
      return;
    }
    type R = { kind: "ok" } | { kind: "owned" } | { kind: "insufficient"; need: number };
    const result = await db.transaction(async (tx): Promise<R> => {
      const [existing] = await tx
        .select({ id: userToysTable.id })
        .from(userToysTable)
        .where(and(eq(userToysTable.walletId, walletId), eq(userToysTable.toySlug, slug)));
      if (existing) return { kind: "owned" };
      const debited = await tx
        .update(walletsTable)
        .set({ coins: sql`${walletsTable.coins} - ${toy.price}`, updatedAt: new Date() })
        .where(and(eq(walletsTable.id, walletId), sql`${walletsTable.coins} >= ${toy.price}`))
        .returning({ coins: walletsTable.coins });
      if (debited.length === 0) {
        const [w] = await tx.select().from(walletsTable).where(eq(walletsTable.id, walletId));
        return { kind: "insufficient", need: toy.price - (w?.coins ?? 0) };
      }
      await tx
        .insert(userToysTable)
        .values({ walletId: walletId, toySlug: slug })
        .onConflictDoNothing({ target: [userToysTable.walletId, userToysTable.toySlug] });
      return { kind: "ok" };
    });
    if (result.kind === "owned") {
      res.status(400).json({ error: "You already own this toy" });
      return;
    }
    if (result.kind === "insufficient") {
      res.status(400).json({ error: `Need ${result.need} more coins` });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({ wallet });
  } catch (err) {
    req.log.error({ err }, "Failed to buy toy");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/collection/:id/play-with/:toySlug", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = PlayPetWithParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  const toySlug = paramsParsed.data.toySlug;
  try {
    type R =
      | { kind: "ok"; pet: UserPet; catalog: Pet; toy: PetToy }
      | { kind: "err"; status: number; error: string };
    const result: R = await db.transaction(async (tx): Promise<R> => {
      const [toy] = await tx.select().from(petToysTable).where(eq(petToysTable.slug, toySlug));
      if (!toy) return { kind: "err", status: 404, error: "Toy not found" };
      const [ownedToy] = await tx
        .select()
        .from(userToysTable)
        .where(and(eq(userToysTable.walletId, walletId), eq(userToysTable.toySlug, toySlug)))
        .for("update");
      if (!ownedToy) return { kind: "err", status: 400, error: "You don't own this toy yet" };
      const now = new Date();
      const cdMs = toy.cooldownMinutes * MINUTE_MS;
      if (ownedToy.lastUsedAt && now.getTime() - new Date(ownedToy.lastUsedAt).getTime() < cdMs) {
        const remain = cdMs - (now.getTime() - new Date(ownedToy.lastUsedAt).getTime());
        return { kind: "err", status: 400, error: `${formatDuration(remain)} till the ${toy.name.toLowerCase()} is ready` };
      }
      const [petRow] = await tx
        .select()
        .from(userPetsTable)
        .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
        .for("update");
      if (!petRow) return { kind: "err", status: 404, error: "Owned pet not found" };
      const [catalog] = await tx.select().from(petsTable).where(eq(petsTable.slug, petRow.petSlug));
      if (!catalog) return { kind: "err", status: 500, error: "Pet catalog missing" };

      // Use toy: refresh play timer (reset play meter to 100 by setting lastPlayAt = now),
      // grant +1 level when happinessGain is significant (>=50), otherwise just refresh play.
      const levelBump = toy.happinessGain >= 50 ? 1 : 0;
      const [updated] = await tx
        .update(userPetsTable)
        .set({
          lastPlayAt: now,
          level: Math.min(MAX_LEVEL, petRow.level + levelBump),
        })
        .where(eq(userPetsTable.id, id))
        .returning();
      await tx
        .update(userToysTable)
        .set({ lastUsedAt: now })
        .where(eq(userToysTable.id, ownedToy.id));
      return { kind: "ok", pet: updated, catalog, toy };
    });
    if (result.kind === "err") {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({ pet: toOwnedPetDto(result.pet, result.catalog, wallet.food), wallet });
  } catch (err) {
    req.log.error({ err }, "Failed to play-with");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// TRAINING
// ---------------------------------------------------------------------------

router.post("/collection/:id/train", async (req, res) => {
  const walletId = req.walletId;
  const paramsParsed = TrainPetParams.safeParse(req.params);
  if (!paramsParsed.success) {
    sendZodError(res, paramsParsed.error);
    return;
  }
  const id = paramsParsed.data.id;
  try {
    type R =
      | { kind: "ok"; pet: UserPet; catalog: Pet; leveledUp: boolean }
      | { kind: "err"; status: number; error: string };
    const result: R = await db.transaction(async (tx): Promise<R> => {
      const [petRow] = await tx
        .select()
        .from(userPetsTable)
        .where(and(eq(userPetsTable.id, id), eq(userPetsTable.walletId, walletId)))
        .for("update");
      if (!petRow) return { kind: "err", status: 404, error: "Owned pet not found" };
      const [catalog] = await tx.select().from(petsTable).where(eq(petsTable.slug, petRow.petSlug));
      if (!catalog) return { kind: "err", status: 500, error: "Pet catalog missing" };
      const now = new Date();
      const elapsed = now.getTime() - new Date(petRow.lastTrainAt).getTime();
      if (elapsed < TRAIN_COOLDOWN_MS) {
        return { kind: "err", status: 400, error: `${formatDuration(TRAIN_COOLDOWN_MS - elapsed)} till next session` };
      }
      const debited = await tx
        .update(walletsTable)
        .set({ coins: sql`${walletsTable.coins} - ${TRAIN_COIN_COST}`, updatedAt: now })
        .where(and(eq(walletsTable.id, walletId), sql`${walletsTable.coins} >= ${TRAIN_COIN_COST}`))
        .returning({ coins: walletsTable.coins });
      if (debited.length === 0) {
        return { kind: "err", status: 400, error: `Training costs ${TRAIN_COIN_COST} coins` };
      }
      const newTricks = petRow.tricksLearned + 1;
      const leveledUp = newTricks % TRICKS_PER_LEVEL === 0;
      const newLevel = leveledUp ? Math.min(MAX_LEVEL, petRow.level + 1) : petRow.level;
      const [updated] = await tx
        .update(userPetsTable)
        .set({ tricksLearned: newTricks, level: newLevel, lastTrainAt: now })
        .where(eq(userPetsTable.id, id))
        .returning();
      return { kind: "ok", pet: updated, catalog, leveledUp };
    });
    if (result.kind === "err") {
      res.status(result.status).json({ error: result.error });
      return;
    }
    const wallet = await getWallet(walletId);
    res.json({
      pet: toOwnedPetDto(result.pet, result.catalog, wallet.food),
      wallet,
      leveledUp: result.leveledUp,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to train pet");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// VISITORS (playdate pups)
// ---------------------------------------------------------------------------

function pickVisitorName(seed: number): string {
  return VISITOR_NAMES[seed % VISITOR_NAMES.length];
}

async function pickVisitorSlug(walletId: string): Promise<string | null> {
  // Pick a random pet slug that the player doesn't already own; if all are owned,
  // pick any random pet from the catalog.
  const ownedRows = await db
    .select({ slug: userPetsTable.petSlug })
    .from(userPetsTable)
    .where(eq(userPetsTable.walletId, walletId));
  const ownedSet = new Set(ownedRows.map((r) => r.slug));
  const allPets = await db.select({ slug: petsTable.slug }).from(petsTable);
  if (allPets.length === 0) return null;
  const candidates = allPets.filter((p) => !ownedSet.has(p.slug));
  const pool = candidates.length > 0 ? candidates : allPets;
  return pool[Math.floor(Math.random() * pool.length)].slug;
}

async function ensureVisitor(walletId: string): Promise<{
  slug: string | null;
  name: string | null;
  breed: string | null;
  imageUrl: string | null;
  availableAt: string;
  ready: boolean;
}> {
  const [w] = await db.select().from(walletsTable).where(eq(walletsTable.id, walletId));
  if (!w) return { slug: null, name: null, breed: null, imageUrl: null, availableAt: new Date().toISOString(), ready: false };
  const now = new Date();
  let slug = w.currentVisitorSlug;
  let availableAt = w.visitorAvailableAt;
  if (!slug && now.getTime() >= new Date(availableAt).getTime()) {
    const picked = await pickVisitorSlug(walletId);
    if (picked) {
      const [updated] = await db
        .update(walletsTable)
        .set({ currentVisitorSlug: picked, updatedAt: now })
        .where(eq(walletsTable.id, walletId))
        .returning();
      slug = updated?.currentVisitorSlug ?? picked;
      availableAt = updated?.visitorAvailableAt ?? availableAt;
    }
  }
  if (!slug) {
    return {
      slug: null,
      name: null,
      breed: null,
      imageUrl: null,
      availableAt: new Date(availableAt).toISOString(),
      ready: false,
    };
  }
  const [pet] = await db.select().from(petsTable).where(eq(petsTable.slug, slug));
  if (!pet) {
    return { slug: null, name: null, breed: null, imageUrl: null, availableAt: new Date(availableAt).toISOString(), ready: false };
  }
  const visitorName = pickVisitorName(Math.floor(new Date(availableAt).getTime() / HOUR_MS));
  return {
    slug: pet.slug,
    name: visitorName,
    breed: pet.breed,
    imageUrl: pet.imagePath,
    availableAt: new Date(availableAt).toISOString(),
    ready: true,
  };
}

router.get("/visitor", async (req, res) => {
  const walletId = req.walletId;
  try {
    res.json(await ensureVisitor(walletId));
  } catch (err) {
    req.log.error({ err }, "Failed to load visitor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/visitor/play", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  try {
    const result = await db.transaction(async (tx) => {
      // Lock the wallet row to prevent concurrent double-spend (V17).
      const [w] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.id, walletId))
        .for("update");
      if (!w) return null;

      const now = new Date();
      // Check if visitor is ready.
      if (!w.currentVisitorSlug) return null;
      const availableAt = new Date(w.visitorAvailableAt);
      if (availableAt.getTime() > now.getTime()) return null;

      const nextAvailable = new Date(now.getTime() + VISITOR_COOLDOWN_MS);
      await tx
        .update(walletsTable)
        .set({
          currentVisitorSlug: null,
          visitorAvailableAt: nextAvailable,
          coins: sql`${walletsTable.coins} + ${VISITOR_REWARD_COINS}`,
          updatedAt: now,
        })
        .where(eq(walletsTable.id, walletId));
      // Also bump play meter on every owned pet.
      await tx
        .update(userPetsTable)
        .set({ lastPlayAt: now })
        .where(and(eq(userPetsTable.walletId, walletId), ne(userPetsTable.id, -1)));
      const wallet = await getWallet(walletId);
      return {
        coinsAwarded: VISITOR_REWARD_COINS,
        visitor: { slug: w.currentVisitorSlug, name: w.currentVisitorSlug, breed: "" },
        nextAvailableAt: nextAvailable.toISOString(),
        wallet,
      };
    });
    if (!result) {
      res.status(400).json({ error: "No visitor right now — check back soon" });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to play with visitor");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/wallet/watch-ad-coins", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  try {
    const result = await db.transaction(async (tx) => {
      // Lock wallet row to prevent concurrent double-spend (V18).
      const [w] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.id, walletId))
        .for("update");
      if (!w) return { error: "Wallet not found", status: 500 };

      const now = new Date();
      if (w.lastWatchAdCoinsAt) {
        const elapsed = now.getTime() - w.lastWatchAdCoinsAt.getTime();
        if (elapsed < AD_WATCH_COINS_COOLDOWN_MS) {
          const waitMs = AD_WATCH_COINS_COOLDOWN_MS - elapsed;
          return { error: `Ad coin bonus on cooldown — try again in ${formatDuration(waitMs)}`, status: 400 };
        }
      }
      await tx
        .update(walletsTable)
        .set({
          coins: sql`${walletsTable.coins} + ${AD_WATCH_COINS}`,
          lastWatchAdCoinsAt: now,
          updatedAt: now,
        })
        .where(eq(walletsTable.id, walletId));
      const wallet = await getWallet(walletId);
      return { data: { coinsAwarded: AD_WATCH_COINS, wallet } };
    });
    if ("error" in result) {
      res.status(result.status as number).json({ error: result.error });
      return;
    }
    res.json(result.data);
  } catch (err) {
    req.log.error({ err }, "Failed to grant watch-ad coins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/visitor/watch-ad-speedup", financialRateLimit, async (req, res) => {
  const walletId = req.walletId;
  try {
    const result = await db.transaction(async (tx) => {
      // Lock wallet row to prevent concurrent cooldown bypass (V19).
      const [w] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.id, walletId))
        .for("update");
      if (!w) return { error: "Wallet not found", status: 500 };

      const now = new Date();
      if (w.currentVisitorSlug) {
        return { error: "A visitor is already here — tap Play first!", status: 400 };
      }
      const availableAt = new Date(w.visitorAvailableAt);
      if (availableAt.getTime() <= now.getTime()) {
        return { error: "No wait to skip — your next visitor is almost here.", status: 400 };
      }
      if (w.lastWatchAdVisitorSpeedupAt) {
        const elapsed = now.getTime() - w.lastWatchAdVisitorSpeedupAt.getTime();
        if (elapsed < VISITOR_AD_SPEEDUP_COOLDOWN_MS) {
          const waitMs = VISITOR_AD_SPEEDUP_COOLDOWN_MS - elapsed;
          return { error: `Ad speed-up on cooldown — try again in ${formatDuration(waitMs)}`, status: 400 };
        }
      }
      const beforeMs = availableAt.getTime();
      const target = new Date(Math.max(now.getTime(), beforeMs - VISITOR_AD_SKIP_MS));
      await tx
        .update(walletsTable)
        .set({
          visitorAvailableAt: target,
          lastWatchAdVisitorSpeedupAt: now,
          updatedAt: now,
        })
        .where(eq(walletsTable.id, walletId));
      const secondsSkipped = Math.max(0, Math.round((beforeMs - target.getTime()) / 1000));
      const visitor = await ensureVisitor(walletId);
      const wallet = await getWallet(walletId);
      return { data: { secondsSkipped, visitor, wallet } };
    });
    if ("error" in result) {
      res.status(result.status as number).json({ error: result.error });
      return;
    }
    res.json(result.data);
  } catch (err) {
    req.log.error({ err }, "Failed to speed up visitor wait");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
