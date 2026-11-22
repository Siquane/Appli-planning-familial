import type { Category, Task } from "../api/types";

export const TASK_CATEGORIES: Category[] = ["École", "Travail", "Maison", "Santé", "Loisirs"];

/**
 * Tâches visibles avec le filtre : celles d'au moins un membre choisi, plus
 * celles qui ne sont à personne en particulier. Aucun membre choisi = tout.
 * Les membres supprimés depuis sont ignorés.
 */
export function filterByMembers<T extends Pick<Task, "memberIds">>(tasks: T[], selected: string[], existing: string[]): T[] {
  const chosen = selected.filter((id) => existing.includes(id));
  if (chosen.length === 0) return tasks;
  return tasks.filter((t) => t.memberIds.length === 0 || t.memberIds.some((id) => chosen.includes(id)));
}

/** Coche ou décoche un membre (ou une catégorie) ; tous cochés revient à « Tous ». */
export function toggleMember(selected: string[], id: string, all: string[]): string[] {
  const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
  return next.length >= all.length ? [] : next;
}

/** Tâches des catégories choisies. Aucune catégorie choisie = tout. */
export function filterByCategories<T extends Pick<Task, "category">>(tasks: T[], selected: string[]): T[] {
  const chosen = selected.filter((c) => (TASK_CATEGORIES as string[]).includes(c));
  if (chosen.length === 0) return tasks;
  return tasks.filter((t) => chosen.includes(t.category));
}
