// Custom task duration typed as hours + minutes (« Autre »). Same bounds as
// the server: 5 min to 8 h.
export const MIN_DURATION = 5;
export const MAX_DURATION = 480;

/** Minutes from the two fields, or null if empty, not a number or out of bounds. */
export function parseDuration(hours: string, minutes: string): number | null {
  const h = hours.trim() === "" ? 0 : Number(hours);
  const m = minutes.trim() === "" ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return null;
  const total = h * 60 + m;
  return total >= MIN_DURATION && total <= MAX_DURATION ? total : null;
}

/** The two fields for a duration in minutes (« 1 » and « 15 » for 75). */
export function splitDuration(total: number): { hours: string; minutes: string } {
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}
