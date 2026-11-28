/** Les étoiles sont pour les enfants : moins de 15 ans (âge saisi, sinon date de naissance). */
export const CHILD_MAX_AGE = 14;

export function memberAge(member: { age: number | null; birthday: Date | null }, now: Date = new Date()): number | null {
  if (member.age != null) return member.age;
  if (!member.birthday) return null;
  const b = member.birthday;
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function isChild(member: { age: number | null; birthday: Date | null }, now: Date = new Date()): boolean {
  const age = memberAge(member, now);
  return age != null && age <= CHILD_MAX_AGE;
}

/** « AAAA-MM-JJ » tombant un lundi. */
export function isMondayKey(week: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return false;
  const d = new Date(`${week}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === week && d.getUTCDay() === 1;
}

/**
 * Bonus de série : une tâche répétée plusieurs jours (même série) faite des
 * jours qui se suivent dans la semaine rapporte des étoiles en plus.
 */
export const SERIES_LEVELS = [
  { days: 3, stars: 1 },
  { days: 5, stars: 2 },
] as const;

/** Le plus grand nombre de jours qui se suivent parmi `weekdays` (0 à 6). */
export function longestRun(weekdays: number[]): number {
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Les paliers atteints pour une série faite `weekdays`. */
export function seriesBonuses(weekdays: number[]) {
  const run = longestRun(weekdays);
  return SERIES_LEVELS.filter((l) => run >= l.days);
}
