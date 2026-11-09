import { Router } from "express";
import { z } from "zod";
import type { Expense } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

// Household budget: expenses entered by hand, one category each, summed per
// month. Amounts travel as integer cents; dates as "YYYY-MM-DD" calendar days
// so a 23:30 entry never slips into the next month through a timezone.

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

export const EXPENSE_CATEGORIES = ["courses", "logement", "transport", "santé", "enfants", "loisirs", "factures", "autre"] as const;

const MAX_AMOUNT_CENTS = 1_000_000_00; // 1 000 000 € — guards against typos

const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), "Date invalide");

const monthString = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mois attendu au format AAAA-MM");

function serializeExpense(e: Expense) {
  return {
    id: e.id,
    label: e.label,
    amountCents: e.amountCents,
    category: e.category,
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

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// GET /expenses?month=2026-11 -> that month's expenses, total and per-category totals.
expensesRouter.get("/", async (req, res) => {
  const parsed = z.object({ month: monthString.optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const month = parsed.data.month ?? currentMonth();

  const expenses = await prisma.expense.findMany({
    where: { userId: req.userId, date: monthRange(month) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const totals = new Map<string, number>();
  for (const e of expenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amountCents);
  const byCategory = [...totals.entries()].map(([category, totalCents]) => ({ category, totalCents })).sort((a, b) => b.totalCents - a.totalCents);

  res.json({
    month,
    totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
    byCategory,
    expenses: expenses.map(serializeExpense),
  });
});

const expenseSchema = z.object({
  label: z.string().trim().min(1, "Un libellé est nécessaire").max(200),
  amountCents: z.number().int().positive("Le montant doit être positif").max(MAX_AMOUNT_CENTS, "Montant trop élevé"),
  category: z.enum(EXPENSE_CATEGORIES),
  date: dayString,
});

expensesRouter.post("/", async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { date, ...rest } = parsed.data;
  const expense = await prisma.expense.create({ data: { ...rest, date: new Date(`${date}T00:00:00Z`), userId: req.userId! } });
  res.status(201).json({ expense: serializeExpense(expense) });
});

async function loadOwnedExpense(userId: string, id: string) {
  return prisma.expense.findFirst({ where: { id, userId } });
}

expensesRouter.patch("/:id", async (req, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const { date, ...rest } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00Z`) } : {}) },
  });
  res.json({ expense: serializeExpense(expense) });
});

expensesRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).end();
});
