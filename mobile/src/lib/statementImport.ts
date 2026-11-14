import type { StatementImportRow, StatementRow } from "../api/types";

// The review screen: what the server read, plus the family's choices on each line.

export interface ReviewRow {
  row: StatementRow;
  selected: boolean;
  category: string;
  recurring: boolean;
}

/** Everything ticked except what is already in the budget; the server's category guess; its monthly hint. */
export function initialReview(rows: StatementRow[]): ReviewRow[] {
  return rows.map((row) => ({ row, selected: !row.duplicate, category: row.category, recurring: row.recurringHint && !row.duplicate }));
}

/** Only the ticked lines. A line whose category was changed is sent with `learn`, so the next statement remembers it. */
export function toImportPayload(review: ReviewRow[]): StatementImportRow[] {
  return review
    .filter((r) => r.selected)
    .map((r) => ({
      date: r.row.date,
      label: r.row.label,
      amountCents: r.row.amountCents,
      category: r.category,
      recurring: r.recurring,
      learn: r.category !== r.row.category,
    }));
}

export function selectedTotal(review: ReviewRow[]) {
  return review.filter((r) => r.selected).reduce((sum, r) => sum + r.row.amountCents, 0);
}

export function selectedCount(review: ReviewRow[]) {
  return review.filter((r) => r.selected).length;
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "2026-10-05" → "5 oct." */
export function formatDay(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Importer 12 dépenses", "Importer 1 dépense", or a prompt to tick something. */
export function importLabel(count: number) {
  if (count === 0) return "Coche au moins une dépense";
  return `Importer ${count} dépense${count > 1 ? "s" : ""}`;
}

/** What to tell after an import. */
export function importedMessage(imported: number, recurringCreated: number) {
  const base = `${imported} dépense${imported > 1 ? "s" : ""} ajoutée${imported > 1 ? "s" : ""} au budget.`;
  if (recurringCreated === 0) return base;
  return `${base} ${recurringCreated} dépense${recurringCreated > 1 ? "s" : ""} récurrente${recurringCreated > 1 ? "s" : ""} créée${recurringCreated > 1 ? "s" : ""}.`;
}
