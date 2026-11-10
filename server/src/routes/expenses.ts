import { Router } from "express";
import { z } from "zod";
import type { Expense } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { checkCategoryAndMember } from "../lib/expenseCategories";
import { materializeRecurring } from "../lib/recurring";

// Household budget: expenses entered by hand (or copied each month from a
// recurring expense), one category each, summed per month and compared to
// each category's monthly cap. Amounts travel as integer cents; dates as
// "YYYY-MM-DD" calendar days so a 23:30 entry never slips into the next
// month through a timezone.

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

export const MAX_AMOUNT_CENTS = 1_000_000_00; // 1 000 000 € — guards against typos

// The family is in France: "this month" flips at midnight Paris time.
const TIMEZONE = "Europe/Paris";

export const amountCents = z.number().int().positive("Le montant doit être positif").max(MAX_AMOUNT_CENTS, "Montant trop élevé");

const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Date invalide");

export const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois attendu au format AAAA-MM");

function serializeExpense(e: Expense) {
  return {
    id: e.id,
    label: e.label,
    amountCents: e.amountCents,
    category: e.category,
    memberId: e.memberId,
    recurringId: e.recurringId,
    date: e.date.toISOString().slice(0, 10),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

/** [first day of month, first day of next month) in UTC — matches @db.Date storage. */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

export function currentMonth(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

// GET /expenses?month=2026-11 -> that month's expenses, total, and per-category
// totals with their cap (categories that have a cap are listed even at 0 €).
expensesRouter.get("/", async (req, res) => {
  const parsed = z.object({ month: monthString.optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  const month = parsed.data.month ?? currentMonth();

  await materializeRecurring(userId, month, currentMonth());

  const [expenses, budgets] = await Promise.all([
    prisma.expense.findMany({ where: { userId, date: monthRange(month) }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.categoryBudget.findMany({ where: { userId } }),
  ]);

  const totals = new Map<string, number>();
  for (const b of budgets) totals.set(b.category, 0);
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountCents);
  const limits = new Map(budgets.map((b) => [b.category, b.limitCents]));
  const byCategory = [...totals.entries()]
    .map(([category, totalCents]) => ({ category, totalCents, limitCents: limits.get(category) ?? null }))
    .sort((a, b) => b.totalCents - a.totalCents || (b.limitCents ?? 0) - (a.limitCents ?? 0));

  res.json({
    month,
    totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
    byCategory,
    expenses: expenses.map(serializeExpense),
  });
});

const expenseSchema = z.object({
  label: z.string().trim().min(1, "Un libellé est nécessaire").max(200),
  amountCents,
  category: z.string().min(1),
  memberId: z.string().nullable().optional(),
  date: dayString,
});

expensesRouter.post("/", async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const problem = await checkCategoryAndMember(req.userId!, parsed.data);
  if (problem) return res.status(400).json({ error: problem });

  const { date, memberId, ...rest } = parsed.data;
  const expense = await prisma.expense.create({
    data: { ...rest, memberId: memberId ?? null, date: new Date(`${date}T00:00:00Z`), userId: req.userId! },
  });
  res.status(201).json({ expense: serializeExpense(expense) });
});

async function loadOwnedExpense(userId: string, id: string) {
  return prisma.expense.findFirst({ where: { id, userId } });
}

// Editing a copy of a recurring expense only changes that month.
expensesRouter.patch("/:id", async (req, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const problem = await checkCategoryAndMember(req.userId!, parsed.data);
  if (problem) return res.status(400).json({ error: problem });

  const { date, ...rest } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00Z`) } : {}) },
  });
  res.json({ expense: serializeExpense(expense) });
});

// Deleting a copy of a recurring expense skips that month only (the
// RecurringRun row stays, so it isn't generated again).
expensesRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).end();
});
