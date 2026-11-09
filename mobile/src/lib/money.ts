import type { ExpenseCategory } from "../api/types";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "courses", label: "Courses" },
  { value: "logement", label: "Logement" },
  { value: "transport", label: "Transport" },
  { value: "santé", label: "Santé" },
  { value: "enfants", label: "Enfants" },
  { value: "loisirs", label: "Loisirs" },
  { value: "factures", label: "Factures" },
  { value: "autre", label: "Autre" },
];

export function expenseCategoryLabel(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
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
