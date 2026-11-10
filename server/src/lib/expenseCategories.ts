import { prisma } from "../db";

// An expense category is either one of these fixed keys or the id of one of
// the family's ExpenseCategory rows (cuids never collide with these words).
// Keep in sync with mobile/src/lib/money.ts (EXPENSE_CATEGORIES, same order).
export const FIXED_EXPENSE_CATEGORIES = [
  "courses",
  "logement",
  "énergie",
  "assurances",
  "transport",
  "santé",
  "enfants",
  "abonnements",
  "restaurants",
  "loisirs",
  "shopping",
  "vacances",
  "impôts",
  "épargne",
  "animaux",
  "cadeaux",
  "divers",
] as const;
/** Where expenses of a deleted custom category go. */
export const FALLBACK_CATEGORY = "divers";

const FIXED_LABELS: Record<(typeof FIXED_EXPENSE_CATEGORIES)[number], string> = {
  courses: "Courses",
  logement: "Logement",
  énergie: "Énergie & eau",
  assurances: "Assurances",
  transport: "Transport",
  santé: "Santé",
  enfants: "Enfants",
  abonnements: "Abonnements & télécom",
  restaurants: "Restaurants & sorties",
  loisirs: "Loisirs",
  shopping: "Shopping & vêtements",
  vacances: "Vacances & voyages",
  impôts: "Impôts & taxes",
  épargne: "Épargne",
  animaux: "Animaux",
  cadeaux: "Cadeaux",
  divers: "Divers",
};

/** True when a custom category name would duplicate a fixed one (key or label, any case). */
export function isFixedCategoryName(name: string) {
  const n = name.trim().toLocaleLowerCase("fr");
  return FIXED_EXPENSE_CATEGORIES.some((key) => key === n || FIXED_LABELS[key].toLocaleLowerCase("fr") === n);
}

export async function isValidCategory(userId: string, category: string) {
  if ((FIXED_EXPENSE_CATEGORIES as readonly string[]).includes(category)) return true;
  return !!(await prisma.expenseCategory.findFirst({ where: { id: category, userId }, select: { id: true } }));
}

export async function ownsMember(userId: string, memberId: string) {
  return !!(await prisma.familyMember.findFirst({ where: { id: memberId, userId }, select: { id: true } }));
}

/** French error for an unknown category or member, or null if both are fine. */
export async function checkCategoryAndMember(userId: string, data: { category?: string; memberId?: string | null }) {
  if (data.category !== undefined && !(await isValidCategory(userId, data.category))) return "Catégorie inconnue";
  if (data.memberId && !(await ownsMember(userId, data.memberId))) return "Membre inconnu";
  return null;
}
