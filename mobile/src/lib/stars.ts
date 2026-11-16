import type { Member } from "../api/types";

/** Les étoiles sont pour les enfants : moins de 15 ans (comme le serveur). */
export const CHILD_MAX_AGE = 14;

export function memberAge(member: Pick<Member, "age" | "birthday">, now: Date = new Date()): number | null {
  if (member.age != null) return member.age;
  if (!member.birthday) return null;
  const b = new Date(member.birthday);
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
}

export function isChild(member: Pick<Member, "age" | "birthday">, now: Date = new Date()): boolean {
  const age = memberAge(member, now);
  return age != null && age <= CHILD_MAX_AGE;
}

/** Lundi de la semaine en cours, « AAAA-MM-JJ » en heure locale. */
export function weekKey(now: Date = new Date()): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
}

export const starsLabel = (n: number) => `${n} étoile${n > 1 ? "s" : ""}`;
