// Calendar days for Cervelle are French days (Europe/Paris), written
// « 2026-11-14 »: a session at 23:30 counts for that evening, not for UTC's
// next day.

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

export function parisDay(d: Date = new Date()): string {
  return fmt.format(d);
}

/** Whole days from `a` to `b` (both « YYYY-MM-DD »); positive when b is later. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * A moment safely before the start of `day` in Paris (UTC midnight minus the
 * largest Paris offset): query from there, then keep rows whose parisDay is `day`.
 */
export function beforeParisDay(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 60 * 60 * 1000);
}

/** Monday of the week containing `day` (« YYYY-MM-DD »). */
export function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return addDays(day, -back);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** 0 = lundi … 6 = dimanche. */
export function weekdayOf(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}
