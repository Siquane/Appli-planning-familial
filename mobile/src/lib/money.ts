import type { CustomExpenseCategory, ExpenseCategory, FixedExpenseCategory } from "../api/types";

export interface CategoryOption {
  value: ExpenseCategory;
  label: string;
  custom: boolean;
}

// Keep in sync with server/src/lib/expenseCategories.ts (same keys, same order).
export const EXPENSE_CATEGORIES: { value: FixedExpenseCategory; label: string }[] = [
  { value: "courses", label: "Courses" },
  { value: "logement", label: "Logement" },
  { value: "énergie", label: "Énergie & eau" },
  { value: "assurances", label: "Assurances" },
  { value: "transport", label: "Transport" },
  { value: "santé", label: "Santé" },
  { value: "enfants", label: "Enfants" },
  { value: "abonnements", label: "Abonnements & télécom" },
  { value: "restaurants", label: "Restaurants & sorties" },
  { value: "loisirs", label: "Loisirs" },
  { value: "shopping", label: "Shopping & vêtements" },
  { value: "vacances", label: "Vacances & voyages" },
  { value: "impôts", label: "Impôts & taxes" },
  { value: "épargne", label: "Épargne" },
  { value: "animaux", label: "Animaux" },
  { value: "cadeaux", label: "Cadeaux" },
  { value: "divers", label: "Divers" },
];

/** Fixed categories, then the family's own, with "Divers" kept last. */
export function buildCategoryOptions(custom: CustomExpenseCategory[]): CategoryOption[] {
  const fixed = EXPENSE_CATEGORIES.map((c) => ({ ...c, custom: false }));
  const other = fixed.filter((c) => c.value === "divers");
  return [...fixed.filter((c) => c.value !== "divers"), ...custom.map((c) => ({ value: c.id, label: c.name, custom: true })), ...other];
}

/** Label for a category key or custom id; an unknown id (just deleted) reads as "Divers". */
export function categoryLabel(options: CategoryOption[], category: ExpenseCategory) {
  return options.find((c) => c.value === category)?.label ?? "Divers";
}

/** "12,50" / "12.5" / "1 200" -> cents, or null when it isn't a positive amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(parseFloat(cleaned) * 100);
  return cents > 0 ? cents : null;
}

/** 123456 -> "1 234,56 €" (narrow no-break space, French style). Formatted by hand: Hermes' Intl support varies. */
export function formatEuros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const rest = (abs % 100).toString().padStart(2, "0");
  return `${sign}${euros},${rest} €`;
}

/** Cents -> the text shown back in the amount field when editing ("12,50"). */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${(cents % 100).toString().padStart(2, "0")}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const SHORT_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const pad = (n: number) => n.toString().padStart(2, "0");

/** Local calendar day as "YYYY-MM-DD". */
export function toDayString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> local Date at midnight. */
export function fromDayString(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function currentMonth(now: Date = new Date()): string {
  return toDayString(now).slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "2026-11" -> "Novembre 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

/** "2026-11-03" -> "3 nov." */
export function shortDay(day: string): string {
  const d = fromDayString(day);
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

/**
 * Whether saving an expense pushes its category over its monthly cap (it
 * wasn't over before). `budget` is the month the expense lands in; `previous`
 * is the expense being edited, if any. Returns the new total and the cap, or
 * null when no alert is due.
 */
export function capCrossed(
  budget: { month: string; byCategory: { category: string; totalCents: number; limitCents: number | null }[] } | undefined,
  next: { category: string; amountCents: number; date: string },
  previous?: { category: string; amountCents: number; date: string },
): { totalCents: number; limitCents: number } | null {
  if (!budget || next.date.slice(0, 7) !== budget.month) return null;
  const row = budget.byCategory.find((c) => c.category === next.category);
  if (!row || row.limitCents === null) return null;
  const before = row.totalCents;
  const counted = previous && previous.category === next.category && previous.date.slice(0, 7) === budget.month ? previous.amountCents : 0;
  const after = before - counted + next.amountCents;
  return before <= row.limitCents && after > row.limitCents ? { totalCents: after, limitCents: row.limitCents } : null;
}

/** Cents as "1234,56" — no thousands separator, so spreadsheets read it as a number. */
export function centsForCsv(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

const csvCell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * A month's expenses as CSV for a French spreadsheet (« ; » between columns,
 * decimal comma), oldest first, with a total line.
 */
export function budgetToCsv(
  expenses: { date: string; label: string; category: string; memberId: string | null; amountCents: number; recurringId: string | null }[],
  labelOf: (category: string) => string,
  memberName: (id: string | null) => string,
): string {
  const rows = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
  const lines = [["Date", "Libellé", "Catégorie", "Pour qui", "Montant (€)", "Récurrente"].join(";")];
  for (const e of rows) {
    lines.push([e.date, csvCell(e.label), csvCell(labelOf(e.category)), csvCell(memberName(e.memberId)), centsForCsv(e.amountCents), e.recurringId ? "oui" : ""].join(";"));
  }
  lines.push(["", "Total", "", "", centsForCsv(rows.reduce((sum, e) => sum + e.amountCents, 0)), ""].join(";"));
  return lines.join("\n");
}

/** "2026-11" -> "nov." (chart axis). */
export function shortMonthLabel(month: string): string {
  return SHORT_MONTHS[Number(month.split("-")[1]) - 1];
}

/** Whole months left until a "YYYY-MM-DD" deadline (at least 1), or null without one. */
export function monthsLeft(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const [y, m] = deadline.split("-").map(Number);
  return Math.max(1, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth()));
}

/**
 * Anneau du budget : la part des plafonds déjà utilisée ; sans plafond, la
 * part du mois écoulée (le mois en cours) ou tout le mois (un mois passé).
 */
export function monthRing(month: string, capCents: number, cappedSpentCents: number, now: Date = new Date()): { done: number; total: number; percent: number; caption: string } {
  if (capCents > 0) return { done: cappedSpentCents, total: capCents, percent: Math.round((cappedSpentCents / capCents) * 100), caption: "des plafonds" };
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const day = month === currentMonth(now) ? now.getDate() : month < currentMonth(now) ? days : 0;
  return { done: day, total: days, percent: Math.round((day / days) * 100), caption: "du mois" };
}
