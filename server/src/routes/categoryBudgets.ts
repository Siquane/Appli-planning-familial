import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { privateSpace, requireAuth } from "../middleware/auth";
import { isValidCategory } from "../lib/expenseCategories";
import { amountCents } from "./expenses";

// Monthly spending cap per category — set once, valid every month.

export const categoryBudgetsRouter = Router();
categoryBudgetsRouter.use(requireAuth, privateSpace);

categoryBudgetsRouter.get("/", async (req, res) => {
  const budgets = await prisma.categoryBudget.findMany({ where: { userId: req.userId } });
  res.json({ budgets: budgets.map((b) => ({ category: b.category, limitCents: b.limitCents })) });
});

// PUT /category-budgets { category, limitCents } — limitCents null removes the cap.
categoryBudgetsRouter.put("/", async (req, res) => {
  const parsed = z.object({ category: z.string().min(1), limitCents: amountCents.nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  const { category, limitCents } = parsed.data;
  if (!(await isValidCategory(userId, category))) return res.status(400).json({ error: "Cette catégorie n'existe plus. Choisis-en une autre." });

  if (limitCents === null) {
    await prisma.categoryBudget.deleteMany({ where: { userId, category } });
    return res.json({ budget: { category, limitCents: null } });
  }
  const budget = await prisma.categoryBudget.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, limitCents },
    update: { limitCents },
  });
  res.json({ budget: { category: budget.category, limitCents: budget.limitCents } });
});
