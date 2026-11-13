import { Router } from "express";
import { z } from "zod";
import type { ShoppingItem } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { patchSchema } from "../lib/validation";

// Family shopping list. Items are typed by hand or generated from the week's
// menu: every ingredient of every recipe planned in a meal slot.

export const shoppingRouter = Router();
shoppingRouter.use(requireAuth);

function serialize(item: ShoppingItem) {
  return { id: item.id, label: item.label, checked: item.checked, fromMenu: item.fromMenu, createdAt: item.createdAt.toISOString() };
}

/** "  2 Courgettes " and "2 courgettes" are the same line. */
export function normalizeLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
}

async function list(userId: string) {
  const items = await prisma.shoppingItem.findMany({ where: { userId }, orderBy: [{ checked: "asc" }, { createdAt: "asc" }] });
  return items.map(serialize);
}

shoppingRouter.get("/", async (req, res) => {
  res.json({ items: await list(req.userId!) });
});

const itemSchema = z.object({
  label: z.string().trim().min(1, "Un article est nécessaire").max(200),
  checked: z.boolean().default(false),
});

shoppingRouter.post("/", async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const item = await prisma.shoppingItem.create({ data: { userId: req.userId!, label: parsed.data.label, checked: parsed.data.checked } });
  res.status(201).json({ item: serialize(item) });
});

// Adds the ingredients of the recipes planned this week that aren't on the
// list yet (unchecked or checked). Hand-typed items are never touched.
shoppingRouter.post("/from-menu", async (req, res) => {
  const userId = req.userId!;
  const meals = await prisma.meal.findMany({
    where: { userId, recipeId: { not: null } },
    include: { recipe: { select: { ingredients: true } } },
  });
  const existing = await prisma.shoppingItem.findMany({ where: { userId }, select: { label: true } });
  const known = new Set(existing.map((i) => normalizeLabel(i.label)));

  const toAdd: string[] = [];
  for (const meal of meals) {
    for (const ingredient of meal.recipe?.ingredients ?? []) {
      const key = normalizeLabel(ingredient);
      if (!key || known.has(key)) continue;
      known.add(key);
      toAdd.push(ingredient.trim().replace(/\s+/g, " "));
    }
  }
  if (toAdd.length > 0) {
    await prisma.shoppingItem.createMany({ data: toAdd.map((label) => ({ userId, label, fromMenu: true })) });
  }
  res.json({ added: toAdd.length, items: await list(userId) });
});

// Empties the basket: removes every checked item.
shoppingRouter.delete("/checked", async (req, res) => {
  const { count } = await prisma.shoppingItem.deleteMany({ where: { userId: req.userId, checked: true } });
  res.json({ removed: count, items: await list(req.userId!) });
});

async function loadOwned(userId: string, id: string) {
  return prisma.shoppingItem.findFirst({ where: { id, userId } });
}

shoppingRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(itemSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwned(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const item = await prisma.shoppingItem.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ item: serialize(item) });
});

shoppingRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwned(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.shoppingItem.delete({ where: { id: existing.id } });
  res.status(204).end();
});
