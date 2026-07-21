import { Router } from "express";
import type { Request, Response } from "express";
import { randomInt } from "node:crypto";
import { db } from "@workspace/db";
import {
  userSocialProfilesTable,
  friendRequestsTable,
  friendshipsTable,
  walletsTable,
  habitsTable,
  habitCompletionsTable,
} from "@workspace/db";
import { eq, and, or, desc, sql, inArray, asc } from "drizzle-orm";
import {
  PatchFriendProfileBody,
  SendFriendRequestBody,
  GetLeaderboardQueryParams,
  AcceptFriendRequestParams,
  DeclineFriendRequestParams,
  CancelFriendRequestParams,
  RemoveFriendParams,
} from "@workspace/api-zod";
import { socialRateLimit, readRateLimit } from "../middlewares/rate-limit";
import { sendZodError } from "../lib/errors";

const router = Router();

const FRIEND_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DISPLAY_FALLBACK = "Player";

function randomFriendCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += FRIEND_CODE_CHARS[randomInt(FRIEND_CODE_CHARS.length)]!;
  }
  return out;
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function ensureSocialProfile(walletId: string) {
  const [existing] = await db
    .select()
    .from(userSocialProfilesTable)
    .where(eq(userSocialProfilesTable.walletId, walletId));
  if (existing) return existing;

  for (let attempt = 0; attempt < 16; attempt++) {
    const friendCode = randomFriendCode();
    try {
      const [row] = await db
        .insert(userSocialProfilesTable)
        .values({
          walletId,
          friendCode,
          displayName: "",
        })
        .returning();
      if (row) return row;
    } catch {
      // duplicate friend_code — retry
    }
  }
  throw new Error("Could not allocate friend code");
}

async function loadProfilesForWallets(walletIds: string[]) {
  if (walletIds.length === 0) return new Map<string, { displayName: string; friendCode: string }>();
  const rows = await db
    .select({
      walletId: userSocialProfilesTable.walletId,
      displayName: userSocialProfilesTable.displayName,
      friendCode: userSocialProfilesTable.friendCode,
    })
    .from(userSocialProfilesTable)
    .where(inArray(userSocialProfilesTable.walletId, walletIds));
  const m = new Map<string, { displayName: string; friendCode: string }>();
  for (const r of rows) {
    m.set(r.walletId, { displayName: r.displayName, friendCode: r.friendCode });
  }
  return m;
}

function displayFor(profile: { displayName: string; friendCode: string } | undefined): {
  displayName: string;
  friendCode: string;
} {
  if (!profile) {
    return { displayName: DISPLAY_FALLBACK, friendCode: "" };
  }
  const name = profile.displayName.trim() || DISPLAY_FALLBACK;
  return { displayName: name, friendCode: profile.friendCode };
}

async function getFriendWalletIds(me: string): Promise<string[]> {
  const rows = await db
    .select({ userA: friendshipsTable.userA, userB: friendshipsTable.userB })
    .from(friendshipsTable)
    .where(or(eq(friendshipsTable.userA, me), eq(friendshipsTable.userB, me)));

  const ids: string[] = [];
  for (const r of rows) {
    ids.push(r.userA === me ? r.userB : r.userA);
  }
  return ids;
}

async function isFriend(a: string, b: string): Promise<boolean> {
  const [x, y] = normalizePair(a, b);
  const [row] = await db
    .select({ a: friendshipsTable.userA })
    .from(friendshipsTable)
    .where(and(eq(friendshipsTable.userA, x), eq(friendshipsTable.userB, y)));
  return !!row;
}

router.get("/friends/me", async (req: Request, res: Response) => {
  const walletId = req.walletId;
  const p = await ensureSocialProfile(walletId);
  res.json({
    walletId,
    displayName: p.displayName,
    friendCode: p.friendCode,
  });
});

router.patch("/friends/me", async (req: Request, res: Response) => {
  const walletId = req.walletId;
  const parsed = PatchFriendProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await ensureSocialProfile(walletId);
  const nextName = parsed.data.displayName?.trim() ?? "";
  const [updated] = await db
    .update(userSocialProfilesTable)
    .set({ displayName: nextName, updatedAt: new Date() })
    .where(eq(userSocialProfilesTable.walletId, walletId))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Profile update failed" });
    return;
  }
  res.json({
    walletId,
    displayName: updated.displayName,
    friendCode: updated.friendCode,
  });
});

router.post("/friends/requests", socialRateLimit, async (req: Request, res: Response) => {
  const me = req.walletId;
  const parsed = SendFriendRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "friendCode is required" });
    return;
  }
  const raw = parsed.data.friendCode.trim().toUpperCase();
  if (!raw) {
    res.status(400).json({ error: "friendCode is empty" });
    return;
  }

  await ensureSocialProfile(me);

  const [targetProfile] = await db
    .select()
    .from(userSocialProfilesTable)
    .where(eq(userSocialProfilesTable.friendCode, raw));

  if (!targetProfile) {
    res.status(404).json({ error: "No user with that friend code" });
    return;
  }

  const targetId = targetProfile.walletId;
  if (targetId === me) {
    res.status(400).json({ error: "You cannot add yourself" });
    return;
  }

  if (await isFriend(me, targetId)) {
    res.status(409).json({ error: "Already friends" });
    return;
  }

  const reverse = await db
    .select()
    .from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.fromWalletId, targetId), eq(friendRequestsTable.toWalletId, me)));

  if (reverse.length > 0) {
    const [reqRow] = reverse;
    const [a, b] = normalizePair(me, targetId);
    await db.transaction(async (tx) => {
      await tx
        .insert(friendshipsTable)
        .values({ userA: a, userB: b })
        .onConflictDoNothing({ target: [friendshipsTable.userA, friendshipsTable.userB] });
      await tx.delete(friendRequestsTable).where(eq(friendRequestsTable.id, reqRow!.id));
    });
    res.status(201).json({ becameFriends: true, requestId: null });
    return;
  }

  const existingSame = await db
    .select()
    .from(friendRequestsTable)
    .where(and(eq(friendRequestsTable.fromWalletId, me), eq(friendRequestsTable.toWalletId, targetId)));

  if (existingSame.length > 0) {
    res.status(409).json({ error: "Request already pending" });
    return;
  }

  const [created] = await db
    .insert(friendRequestsTable)
    .values({ fromWalletId: me, toWalletId: targetId })
    .returning({ id: friendRequestsTable.id });

  res.status(201).json({
    becameFriends: false,
    requestId: created?.id ?? null,
  });
});

router.get("/friends/requests", async (req: Request, res: Response) => {
  const me = req.walletId;
  await ensureSocialProfile(me);

  const incomingRows = await db
    .select()
    .from(friendRequestsTable)
    .where(eq(friendRequestsTable.toWalletId, me))
    .orderBy(desc(friendRequestsTable.createdAt));

  const outgoingRows = await db
    .select()
    .from(friendRequestsTable)
    .where(eq(friendRequestsTable.fromWalletId, me))
    .orderBy(desc(friendRequestsTable.createdAt));

  const walletSet = new Set<string>();
  for (const r of [...incomingRows, ...outgoingRows]) {
    walletSet.add(r.fromWalletId);
    walletSet.add(r.toWalletId);
  }
  const profileMap = await loadProfilesForWallets([...walletSet]);

  const mapReq = (r: (typeof incomingRows)[0]) => {
    const fromP = displayFor(profileMap.get(r.fromWalletId));
    const toP = displayFor(profileMap.get(r.toWalletId));
    return {
      id: r.id,
      fromWalletId: r.fromWalletId,
      toWalletId: r.toWalletId,
      fromDisplayName: fromP.displayName,
      toDisplayName: toP.displayName,
      fromFriendCode: fromP.friendCode,
      toFriendCode: toP.friendCode,
      createdAt: r.createdAt,
    };
  };

  res.json({
    incoming: incomingRows.map(mapReq),
    outgoing: outgoingRows.map(mapReq),
  });
});

router.post("/friends/requests/:requestId/accept", async (req: Request, res: Response) => {
  const me = req.walletId;
  const params = AcceptFriendRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid request id" });
    return;
  }
  const requestId = params.data.requestId;

  const [row] = await db.select().from(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
  if (!row || row.toWalletId !== me) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  const other = row.fromWalletId;
  const [a, b] = normalizePair(me, other);

  await db.transaction(async (tx) => {
    await tx
      .insert(friendshipsTable)
      .values({ userA: a, userB: b })
      .onConflictDoNothing({ target: [friendshipsTable.userA, friendshipsTable.userB] });
    await tx.delete(friendRequestsTable).where(eq(friendRequestsTable.id, requestId));
  });

  res.json({ friendWalletId: other });
});

router.post("/friends/requests/:requestId/decline", async (req: Request, res: Response) => {
  const me = req.walletId;
  const params = DeclineFriendRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid request id" });
    return;
  }

  const [row] = await db
    .select()
    .from(friendRequestsTable)
    .where(eq(friendRequestsTable.id, params.data.requestId));
  if (!row || row.toWalletId !== me) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, row.id));
  res.status(204).send();
});

router.delete("/friends/requests/:requestId", async (req: Request, res: Response) => {
  const me = req.walletId;
  const params = CancelFriendRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid request id" });
    return;
  }

  const [row] = await db
    .select()
    .from(friendRequestsTable)
    .where(eq(friendRequestsTable.id, params.data.requestId));
  if (!row || row.fromWalletId !== me) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  await db.delete(friendRequestsTable).where(eq(friendRequestsTable.id, row.id));
  res.status(204).send();
});

router.get("/friends", async (req: Request, res: Response) => {
  const me = req.walletId;
  await ensureSocialProfile(me);

  const friendIds = await getFriendWalletIds(me);
  const profileMap = await loadProfilesForWallets(friendIds);

  const out = friendIds.map((wid) => {
    const p = displayFor(profileMap.get(wid));
    return {
      walletId: wid,
      displayName: p.displayName,
      friendCode: p.friendCode,
    };
  });

  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  res.json(out);
});

router.delete("/friends/:walletId", async (req: Request, res: Response) => {
  const me = req.walletId;
  const params = RemoveFriendParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid wallet id" });
    return;
  }
  const other = params.data.walletId;
  if (other === me) {
    res.status(400).json({ error: "Invalid target" });
    return;
  }

  const [x, y] = normalizePair(me, other);
  const deleted = await db
    .delete(friendshipsTable)
    .where(and(eq(friendshipsTable.userA, x), eq(friendshipsTable.userB, y)))
    .returning({ a: friendshipsTable.userA });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not friends with this user" });
    return;
  }

  res.status(204).send();
});

router.get("/leaderboard", readRateLimit, async (req: Request, res: Response) => {
  const me = req.walletId;
  const parsed = GetLeaderboardQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query" });
    return;
  }
  const { scope, metric, limit } = parsed.data;
  await ensureSocialProfile(me);

  let scopeWalletIds: string[] | null = null;
  if (scope === "friends") {
    const friends = await getFriendWalletIds(me);
    scopeWalletIds = [me, ...friends];
  }

  type Row = { walletId: string; score: number };
  let ranked: Row[];

  if (metric === "coins") {
    ranked =
      scopeWalletIds === null
        ? await db
            .select({
              walletId: walletsTable.id,
              score: walletsTable.coins,
            })
            .from(walletsTable)
            .orderBy(desc(walletsTable.coins), asc(walletsTable.id))
            .limit(limit)
        : await db
            .select({
              walletId: walletsTable.id,
              score: walletsTable.coins,
            })
            .from(walletsTable)
            .where(inArray(walletsTable.id, scopeWalletIds))
            .orderBy(desc(walletsTable.coins), asc(walletsTable.id))
            .limit(limit);
  } else {
    ranked =
      scopeWalletIds === null
        ? await db
            .select({
              walletId: habitsTable.walletId,
              score: sql<number>`cast(count(${habitCompletionsTable.id}) as int)`,
            })
            .from(habitCompletionsTable)
            .innerJoin(habitsTable, eq(habitCompletionsTable.habitId, habitsTable.id))
            .groupBy(habitsTable.walletId)
            .orderBy(desc(sql`count(${habitCompletionsTable.id})`), asc(habitsTable.walletId))
            .limit(limit)
        : await db
            .select({
              walletId: habitsTable.walletId,
              score: sql<number>`cast(count(${habitCompletionsTable.id}) as int)`,
            })
            .from(habitCompletionsTable)
            .innerJoin(habitsTable, eq(habitCompletionsTable.habitId, habitsTable.id))
            .where(inArray(habitsTable.walletId, scopeWalletIds))
            .groupBy(habitsTable.walletId)
            .orderBy(desc(sql`count(${habitCompletionsTable.id})`), asc(habitsTable.walletId))
            .limit(limit);
  }

  const ids = ranked.map((r) => r.walletId);
  const profileMap = await loadProfilesForWallets(ids);

  const entries = ranked.map((r, i) => {
    const p = displayFor(profileMap.get(r.walletId));
    return {
      rank: i + 1,
      walletId: r.walletId,
      displayName: p.displayName,
      friendCode: p.friendCode,
      score: r.score,
      isSelf: r.walletId === me,
    };
  });

  res.json({
    scope,
    metric,
    entries,
  });
});

export default router;
