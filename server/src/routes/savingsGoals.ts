import { Router } from "express";
import { z } from "zod";
import type { SavingsGoal } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { requireBudgetPack } from "../lib/plan";
import { amountCents } from "./expenses";

// Premium: savings goals (« Vacances d'été : 1 200 € »). A payment into a goal
// is an ordinary expense in the 'épargne' category linked to it, so it shows
// in the month's budget too; the goal's progress is the sum of those.

export const savingsGoalsRouter = Router();
savingsGoalsRouter.use(requireAuth);

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

function serialize(goal: SavingsGoal, savedCents: number) {
  return {
    id: goal.id,
    name: goal.name,
    targetCents: goal.targetCents,
    savedCents,
    deadline: goal.deadline ? goal.deadline.toISOString().slice(0, 10) : null,
  };
}

async function savedByGoal(userId: string) {
  const rows = await prisma.expense.groupBy({ by: ["goalId"], where: { userId, goalId: { not: null } }, _sum: { amountCents: true } });
  return new Map(rows.map((r) => [r.goalId!, r._sum.amountCents ?? 0]));
}

// Listing stays open to everyone so goals created while subscribed remain visible.
savingsGoalsRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const [goals, saved] = await Promise.all([prisma.savingsGoal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }), savedByGoal(userId)]);
  res.json({ goals: goals.map((g) => serialize(g, saved.get(g.id) ?? 0)) });
});

const goalSchema = z.object({
  name: z.string().trim().min(1, "Un nom est nécessaire").max(60),
  targetCents: amountCents,
  deadline: dayString.nullable().optional(),
});

savingsGoalsRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Les objectifs d'épargne"))) return;
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { deadline, ...rest } = parsed.data;
  const goal = await prisma.savingsGoal.create({
    data: { ...rest, userId, deadline: deadline ? new Date(`${deadline}T00:00:00Z`) : null },
  });
  res.status(201).json({ goal: serialize(goal, 0) });
});

savingsGoalsRouter.patch("/:id", async (req, res) => {
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Les objectifs d'épargne"))) return;
  const parsed = goalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const { deadline, ...rest } = parsed.data;
  const goal = await prisma.savingsGoal.update({
    where: { id: existing.id },
    data: { ...rest, ...(deadline !== undefined ? { deadline: deadline ? new Date(`${deadline}T00:00:00Z`) : null } : {}) },
  });
  res.json({ goal: serialize(goal, (await savedByGoal(userId)).get(goal.id) ?? 0) });
});

// Deleting a goal keeps its payments as plain 'épargne' expenses (goalId set to null).
savingsGoalsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.savingsGoal.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// POST /savings-goals/:id/payments { amountCents, date? } -> a new 'épargne' expense for the goal.
savingsGoalsRouter.post("/:id/payments", async (req, res) => {
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Les objectifs d'épargne"))) return;
  const parsed = z.object({ amountCents, date: dayString.optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId } });
  if (!goal) return res.status(404).json({ error: "Not found" });
  const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  await prisma.expense.create({
    data: {
      userId,
      label: `Épargne · ${goal.name}`,
      amountCents: parsed.data.amountCents,
      category: "épargne",
      goalId: goal.id,
      date: new Date(`${date}T00:00:00Z`),
    },
  });
  res.status(201).json({ goal: serialize(goal, (await savedByGoal(userId)).get(goal.id) ?? 0), month: date.slice(0, 7) });
});
