import { Router } from "express";
import { z } from "zod";
import type { Expense } from "@prisma/client";
import { prisma } from "../db";
import { privateSpace, requireAuth } from "../middleware/auth";
import { checkCategoryAndMember } from "../lib/expenseCategories";
import { materializeRecurring } from "../lib/recurring";
import { patchSchema } from "../lib/validation";
import { checkCapAlert } from "../lib/capAlerts";
import { checkDriftAlert, getDebits, getDrifts } from "../lib/drifts";
import { requireBudgetPack } from "../lib/plan";
import { forecastMonth } from "../lib/forecast";
import { daysInMonth } from "../lib/recurring";
import { toCsv, toPdf, type ExportRow } from "../lib/expenseExport";
import { FIXED_LABELS } from "../lib/expenseCategories";

// Household budget: expenses entered by hand (or copied each month from a
// recurring expense), one category each, summed per month and compared to
// each category's monthly cap. Amounts travel as integer cents; dates as
// "YYYY-MM-DD" calendar days so a 23:30 entry never slips into the next
// month through a timezone.

export const expensesRouter = Router();
expensesRouter.use(requireAuth, privateSpace);

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
    goalId: e.goalId,
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

// Premium: GET /expenses/report?months=6 -> the last N months (oldest
// first), each with its total and per-category totals, for the charts.
expensesRouter.get("/report", async (req, res) => {
  const parsed = z.object({ months: z.coerce.number().int().min(2).max(12).default(6) }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Le bilan"))) return;

  const now = currentMonth();
  const months = Array.from({ length: parsed.data.months }, (_, i) => shiftMonth(now, i - parsed.data.months + 1));
  for (const m of months) await materializeRecurring(userId, m, now);

  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: monthRange(months[0]).gte, lt: monthRange(now).lt } },
    select: { amountCents: true, category: true, date: true },
  });
  const report = months.map((month) => {
    const inMonth = expenses.filter((e) => e.date.toISOString().startsWith(month));
    const byCat = new Map<string, number>();
    for (const e of inMonth) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountCents);
    return {
      month,
      totalCents: inMonth.reduce((sum, e) => sum + e.amountCents, 0),
      byCategory: [...byCat.entries()].map(([category, totalCents]) => ({ category, totalCents })).sort((a, b) => b.totalCents - a.totalCents),
    };
  });
  res.json({ months: report });
});

// Premium: GET /expenses/forecast -> where the current month is heading.
expensesRouter.get("/forecast", async (req, res) => {
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "La prévision"))) return;
  const month = currentMonth();
  const today = todayString();
  await materializeRecurring(userId, month, month);

  const history = [1, 2, 3].map((n) => shiftMonth(month, -n));
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: monthRange(history[2]).gte, lt: monthRange(month).lt } },
    select: { amountCents: true, date: true, recurringId: true },
  });
  const inMonth = (m: string) => expenses.filter((e) => e.date.toISOString().startsWith(m));
  const sum = (list: { amountCents: number }[]) => list.reduce((a, e) => a + e.amountCents, 0);

  const current = inMonth(month);
  const day = (e: { date: Date }) => e.date.toISOString().slice(0, 10);
  const recurring = current.filter((e) => e.recurringId);
  const variable = current.filter((e) => !e.recurringId);
  // Only past months that had spending: a month before the app was used says nothing.
  const past = history.map(inMonth).filter((list) => list.length > 0);

  const forecast = forecastMonth(
    {
      today: Number(today.slice(8, 10)),
      daysInMonth: daysInMonth(month),
      recurringCents: sum(recurring),
      upcomingRecurringCents: sum(recurring.filter((e) => day(e) > today)),
      variableSoFarCents: sum(variable.filter((e) => day(e) <= today)),
      plannedVariableCents: sum(variable.filter((e) => day(e) > today)),
      previousVariableCents: past.map((list) => sum(list.filter((e) => !e.recurringId))),
    },
    past.map(sum),
  );
  res.json({ month, ...forecast });
});

// Budget+ : GET /expenses/drifts?month=2026-11 -> catégories nettement plus
// chères que la moyenne des 3 mois précédents (lib/drifts.ts).
expensesRouter.get("/drifts", async (req, res) => {
  const parsed = z.object({ month: monthString.optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Les dépenses en hausse"))) return;
  const now = currentMonth();
  const month = parsed.data.month ?? now;
  for (let i = 3; i >= 0; i--) await materializeRecurring(userId, shiftMonth(month, -i), now);
  const drifts = await getDrifts(userId, month);
  res.json({ month, drifts });
});

// Budget+ : GET /expenses/debits?month=2026-11 -> les dépenses récurrentes du
// mois jour par jour, avec ce qui est déjà passé et ce qui reste à venir.
expensesRouter.get("/debits", async (req, res) => {
  const parsed = z.object({ month: monthString.optional() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "Le calendrier des prélèvements"))) return;
  const now = currentMonth();
  const month = parsed.data.month ?? now;
  await materializeRecurring(userId, month, now);
  res.json(await getDebits(userId, month, now, todayString()));
});

// Budget pack: GET /expenses/export?from=2026-01&to=2026-11&format=csv|pdf
// -> the file itself (attachment), oldest expense first. 24 months at most.
expensesRouter.get("/export", async (req, res) => {
  const parsed = z
    .object({ from: monthString, to: monthString, format: z.enum(["csv", "pdf"]) })
    .refine((q) => q.from <= q.to, "La période est inversée")
    .refine((q) => monthsBetween(q.from, q.to) < 24, "24 mois au maximum")
    .safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  if (!(await requireBudgetPack(userId, res, "L'export"))) return;
  const { from, to, format } = parsed.data;

  const now = currentMonth();
  for (let m = from; m <= to && m <= now; m = shiftMonth(m, 1)) await materializeRecurring(userId, m, now);

  const [user, expenses, custom] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } }),
    prisma.expense.findMany({
      where: { userId, date: { gte: monthRange(from).gte, lt: monthRange(to).lt } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      include: { member: { select: { name: true } } },
    }),
    prisma.expenseCategory.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const names = new Map<string, string>([...Object.entries(FIXED_LABELS), ...custom.map((c) => [c.id, c.name] as [string, string])]);
  const rows: ExportRow[] = expenses.map((e) => ({
    date: e.date.toISOString().slice(0, 10),
    label: e.label,
    category: names.get(e.category) ?? FIXED_LABELS.divers,
    member: e.member?.name ?? "",
    amountCents: e.amountCents,
    recurring: !!e.recurringId,
  }));

  const data = { familyName: user.name, from, to, rows };
  const fileName = `depenses-${from}${from === to ? "" : `-${to}`}.${format}`;
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  if (format === "csv") {
    res.type("text/csv; charset=utf-8").send(toCsv(data));
  } else {
    res.type("application/pdf").send(await toPdf(data));
  }
});

function monthsBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Today in Paris as "YYYY-MM-DD". */
function todayString(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "2026-11" shifted by n months. */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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
  const alert = await checkCapAlert(req.userId!, expense.category, date.slice(0, 7));
  const drift = await checkDriftAlert(req.userId!, expense.category, date.slice(0, 7), req.accountId!);
  res.status(201).json({ expense: serializeExpense(expense), alert, drift });
});

async function loadOwnedExpense(userId: string, id: string) {
  return prisma.expense.findFirst({ where: { id, userId } });
}

// Editing a copy of a recurring expense only changes that month.
expensesRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(expenseSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  const problem = await checkCategoryAndMember(req.userId!, parsed.data);
  if (problem) return res.status(400).json({ error: problem });

  const { date, ...rest } = parsed.data;
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00Z`) } : {}) },
  });
  const month = expense.date.toISOString().slice(0, 7);
  const alert = await checkCapAlert(req.userId!, expense.category, month);
  const drift = await checkDriftAlert(req.userId!, expense.category, month, req.accountId!);
  res.json({ expense: serializeExpense(expense), alert, drift });
});

// Deleting a copy of a recurring expense skips that month only (the
// RecurringRun row stays, so it isn't generated again).
expensesRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedExpense(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  await prisma.expense.delete({ where: { id: existing.id } });
  res.status(204).end();
});
