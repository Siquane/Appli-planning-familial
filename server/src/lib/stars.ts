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
