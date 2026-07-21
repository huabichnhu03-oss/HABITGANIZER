import { Router, type Request, type Response } from "express";
import { db, groceryItemsTable } from "@workspace/db";
import { and, eq, sql, asc } from "drizzle-orm";
import {
  CreateGroceryItemBody,
  UpdateGroceryItemBody,
  UpdateGroceryItemParams,
  DeleteGroceryItemParams,
} from "@workspace/api-zod";

export const GROCERY_NAME_MAX = 80;
export const GROCERY_MAX_ITEMS_PER_WALLET = 100;

const router = Router();

function mapRow(row: typeof groceryItemsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    checked: row.checked,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

async function countForWallet(walletId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(groceryItemsTable)
    .where(eq(groceryItemsTable.walletId, walletId));
  return r?.n ?? 0;
}

async function nextSortOrder(walletId: string): Promise<number> {
  const [r] = await db
    .select({ m: sql<number>`coalesce(max(${groceryItemsTable.sortOrder}), -1)::int` })
    .from(groceryItemsTable)
    .where(eq(groceryItemsTable.walletId, walletId));
  return (r?.m ?? -1) + 1;
}

router.get("/grocery-items", async (req: Request, res: Response) => {
  const walletId = req.walletId;
  const rows = await db
    .select()
    .from(groceryItemsTable)
    .where(eq(groceryItemsTable.walletId, walletId))
    .orderBy(asc(groceryItemsTable.sortOrder), asc(groceryItemsTable.id));

  res.json(rows.map(mapRow));
});

router.post("/grocery-items", async (req: Request, res: Response) => {
  const parsed = CreateGroceryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const name = parsed.data.name.trim().slice(0, GROCERY_NAME_MAX);
  if (name.length === 0) {
    res.status(400).json({ error: "Name required" });
    return;
  }

  const checked = parsed.data.checked ?? false;

  const walletId = req.walletId;
  if ((await countForWallet(walletId)) >= GROCERY_MAX_ITEMS_PER_WALLET) {
    res.status(400).json({ error: "Grocery list limit reached" });
    return;
  }

  const sortOrder = await nextSortOrder(walletId);
  const [row] = await db
    .insert(groceryItemsTable)
    .values({ walletId, name, checked, sortOrder })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Create failed" });
    return;
  }

  res.status(201).json(mapRow(row));
});

/** Static path before `:id` routes. */
router.post("/grocery-items/clear-checked", async (req: Request, res: Response) => {
  const walletId = req.walletId;
  await db
    .delete(groceryItemsTable)
    .where(and(eq(groceryItemsTable.walletId, walletId), eq(groceryItemsTable.checked, true)));

  res.status(204).send();
});

router.patch("/grocery-items/:id", async (req: Request, res: Response) => {
  const paramsParsed = UpdateGroceryItemParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = paramsParsed.data.id;

  const bodyParsed = UpdateGroceryItemBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const patch = bodyParsed.data;
  if (
    patch.name === undefined &&
    patch.checked === undefined &&
    patch.sortOrder === undefined
  ) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const walletId = req.walletId;
  const [existing] = await db
    .select()
    .from(groceryItemsTable)
    .where(and(eq(groceryItemsTable.id, id), eq(groceryItemsTable.walletId, walletId)));

  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updates: Partial<typeof groceryItemsTable.$inferInsert> = {};
  if (patch.checked !== undefined) updates.checked = patch.checked;
  if (patch.sortOrder !== undefined) updates.sortOrder = patch.sortOrder;
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, GROCERY_NAME_MAX);
    if (name.length === 0) {
      res.status(400).json({ error: "Name cannot be empty" });
      return;
    }
    updates.name = name;
  }

  const [row] = await db
    .update(groceryItemsTable)
    .set(updates)
    .where(and(eq(groceryItemsTable.id, id), eq(groceryItemsTable.walletId, walletId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(mapRow(row));
});

router.delete("/grocery-items/:id", async (req: Request, res: Response) => {
  const paramsParsed = DeleteGroceryItemParams.safeParse(req.params);
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = paramsParsed.data.id;
  const walletId = req.walletId;

  const deleted = await db
    .delete(groceryItemsTable)
    .where(and(eq(groceryItemsTable.id, id), eq(groceryItemsTable.walletId, walletId)))
    .returning({ id: groceryItemsTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.status(204).send();
});

export default router;
