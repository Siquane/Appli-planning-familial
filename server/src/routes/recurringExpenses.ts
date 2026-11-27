import { Router } from "express";
import { z } from "zod";
import type { RecurringExpense } from "@prisma/client";
import { prisma } from "../db";
import { privateSpace, requireAuth } from "../middleware/auth";
import { checkCategoryAndMember } from "../lib/expenseCategories";
import { amountCents, currentMonth } from "./expenses";
import { patchSchema } from "../lib/validation";

// Recurring expenses (rent, subscriptions…): copied into the month's expenses
// on dayOfMonth, starting with the month they're created in. See lib/recurring.ts.
// Editing or deleting the template only affects months not generated yet —
// past copies are kept as they are.

export const recurringExpensesRouter = Router();
recurringExpensesRouter.use(requireAuth, privateSpace);

function serialize(r: RecurringExpense) {
  return {
    id: r.id,
    label: r.label,
    amountCents: r.amountCents,
    category: r.category,
    memberId: r.memberId,
    dayOfMonth: r.dayOfMonth,
    startMonth: r.startMonth,
  };
}

const schema = z.object({
  label: z.string().trim().min(1, "Un libellé est nécessaire").max(200),
  amountCents,
  category: z.string().min(1),
  memberId: z.string().nullable().optional(),
  dayOfMonth: z.number().int().min(1, "Jour entre 1 et 31").max(31, "Jour entre 1 et 31"),
});

recurringExpensesRouter.get("/", async (req, res) => {
  const recurring = await prisma.recurringExpense.findMany({ where: { userId: req.userId }, orderBy: [{ dayOfMonth: "asc" }, { createdAt: "asc" }] });
  res.json({ recurring: recurring.map(serialize) });
});

recurringExpensesRouter.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const problem = await checkCategoryAndMember(req.userId!, parsed.data);
  if (problem) return res.status(400).json({ error: problem });
  const { memberId, ...rest } = parsed.data;
  const recurring = await prisma.recurringExpense.create({
    data: { ...rest, memberId: memberId ?? null, userId: req.userId!, startMonth: currentMonth() },
  });
  res.status(201).json({ recurring: serialize(recurring) });
});

recurringExpensesRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(schema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.recurringExpense.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  const problem = await checkCategoryAndMember(req.userId!, parsed.data);
  if (problem) return res.status(400).json({ error: problem });
  const recurring = await prisma.recurringExpense.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ recurring: serialize(recurring) });
});

recurringExpensesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.recurringExpense.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  await prisma.recurringExpense.delete({ where: { id: existing.id } });
  res.status(204).end();
});
