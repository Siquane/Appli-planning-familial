import type { Weekday } from "../api/types";
import { WEEKDAYS_SHORT } from "./weekdays";

export type DayTimes = Partial<Record<Weekday, string>>;

const TIME_RE = /^\d{2}:\d{2}$/;

/** Selected days in week order (Lun → Dim), whatever order they were tapped in. */
export function sortWeekdays(weekdays: Weekday[]): Weekday[] {
  return [...weekdays].sort((a, b) => a - b);
}

/**
 * The time to use for each selected day: the shared `time`, or — when
 * "heure différente selon le jour" is on — that day's own time (falling back
 * to the shared one if it was never set).
 */
export function resolveTimes(weekdays: Weekday[], time: string, perDay: boolean, dayTimes: DayTimes): DayTimes {
  const out: DayTimes = {};
  for (const w of sortWeekdays(weekdays)) out[w] = perDay ? (dayTimes[w] ?? time) : time;
  return out;
}

export function allTimesValid(times: DayTimes): boolean {
  return Object.values(times).every((t) => !!t && TIME_RE.test(t));
}

/** "Mar · Jeu — 08:00" when every day shares a time, else "Mar 11:30 · Jeu 17:00". */
export function describeSchedule(times: DayTimes): string {
  const days = sortWeekdays(Object.keys(times).map(Number) as Weekday[]);
  const distinct = new Set(days.map((w) => times[w]));
  if (distinct.size <= 1) return `${days.map((w) => WEEKDAYS_SHORT[w]).join(" · ")} — ${times[days[0]] ?? ""}`;
  return days.map((w) => `${WEEKDAYS_SHORT[w]} ${times[w]}`).join(" · ");
}
