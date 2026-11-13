import type { ReportMonth } from "../api/types";

export interface CategoryChange {
  category: string;
  deltaCents: number;
  /** Rounded % change, null when the category was at 0 € the month before. */
  percent: number | null;
}

/** Per-category change from `previous` to `current`, biggest moves first; unchanged categories are left out. */
export function compareMonths(current: ReportMonth, previous: ReportMonth): CategoryChange[] {
  const before = new Map(previous.byCategory.map((c) => [c.category, c.totalCents]));
  const after = new Map(current.byCategory.map((c) => [c.category, c.totalCents]));
  const categories = new Set([...before.keys(), ...after.keys()]);
  return [...categories]
    .map((category) => {
      const was = before.get(category) ?? 0;
      const deltaCents = (after.get(category) ?? 0) - was;
      return { category, deltaCents, percent: was > 0 ? Math.round((deltaCents * 100) / was) : null };
    })
    .filter((c) => c.deltaCents !== 0)
    .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents));
}
