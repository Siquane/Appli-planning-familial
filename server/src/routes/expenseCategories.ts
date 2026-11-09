import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { FALLBACK_CATEGORY, FIXED_EXPENSE_CATEGORIES } from "../lib/expenseCategories";

// The family's own expense categories, on top of the fixed list.

export const expenseCategoriesRouter = Router();
expenseCategoriesRouter.use(requireAuth);

const nameSchema = z.object({ name: z.string().trim().min(1, "Un nom est nécessaire").max(60) });

function serialize(c: { id: string; name: string }) {
  return { id: c.id, name: c.name };
}

async function nameTaken(userId: string, name: string, exceptId?: string) {
  if ((FIXED_EXPENSE_CATEGORIES as readonly string[]).includes(name.toLocaleLowerCase("fr"))) return true;
  const same = await prisma.expenseCategory.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return !!same;
}

expenseCategoriesRouter.get("/", async (req, res) => {
  const categories = await prisma.expenseCategory.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });
  res.json({ fixed: FIXED_EXPENSE_CATEGORIES, categories: categories.map(serialize) });
});

expenseCategoriesRouter.post("/", async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  if (await nameTaken(req.userId!, parsed.data.name)) return res.status(400).json({ error: "Cette catégorie existe déjà" });
  const category = await prisma.expenseCategory.create({ data: { userId: req.userId!, name: parsed.data.name } });
  res.status(201).json({ category: serialize(category) });
});

expenseCategoriesRouter.patch("/:id", async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.expenseCategory.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (await nameTaken(req.userId!, parsed.data.name, existing.id)) return res.status(400).json({ error: "Cette catégorie existe déjà" });
  const category = await prisma.expenseCategory.update({ where: { id: existing.id }, data: { name: parsed.data.name } });
  res.json({ category: serialize(category) });
});

// Expenses and recurring expenses move to "Autre"; the category's cap goes away.
expenseCategoriesRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const existing = await prisma.expenseCategory.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.$transaction([
    prisma.expense.updateMany({ where: { userId, category: existing.id }, data: { category: FALLBACK_CATEGORY } }),
    prisma.recurringExpense.updateMany({ where: { userId, category: existing.id }, data: { category: FALLBACK_CATEGORY } }),
    prisma.categoryBudget.deleteMany({ where: { userId, category: existing.id } }),
    prisma.expenseCategory.delete({ where: { id: existing.id } }),
  ]);
  res.status(204).end();
});
