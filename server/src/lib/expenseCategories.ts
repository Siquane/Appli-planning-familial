import { prisma } from "../db";

// An expense category is either one of these fixed keys or the id of one of
// the family's ExpenseCategory rows (cuids never collide with these words).
export const FIXED_EXPENSE_CATEGORIES = ["courses", "logement", "transport", "santé", "enfants", "loisirs", "factures", "autre"] as const;
export const FALLBACK_CATEGORY = "autre";

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
