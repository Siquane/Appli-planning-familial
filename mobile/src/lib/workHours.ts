import { WEEKDAYS_SHORT } from "./weekdays";
import type { WorkHours } from "../api/types";

/** « Lun–Ven 09:00–17:30 », « Lun, Mer, Ven 08:00–12:00 », ou null sans horaires. */
export function workSummary(work: WorkHours | undefined): string | null {
  if (!work || work.days.length === 0) return null;
  const days = [...work.days].sort((a, b) => a - b);
  const consecutive = days.length > 2 && days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const label = consecutive ? `${WEEKDAYS_SHORT[days[0]]}–${WEEKDAYS_SHORT[days[days.length - 1]]}` : days.map((d) => WEEKDAYS_SHORT[d]).join(", ");
  return `${label} ${work.start}–${work.end}`;
}
