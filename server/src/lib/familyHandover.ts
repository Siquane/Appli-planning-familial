import { prisma } from "../db";

// When the creator of a family deletes their account, the family does not have
// to disappear: its data (every row keyed by the owner's id) moves to another
// adult who joined with the full profile. The others stay in the family.
// Subscriptions are the owner's own (store account): the new owner starts
// from the free offer and takes their own if they want one.

export type FamilyNotice =
  | { kind: "heir"; from: string }
  | { kind: "newOwner"; from: string; heir: string }
  | { kind: "detached"; from: string };

export interface HeirCandidate {
  id: string;
  name: string;
}

/** Adults who could take the family over, oldest account first. */
export async function heirCandidates(ownerId: string): Promise<HeirCandidate[]> {
  return prisma.user.findMany({
    where: { familyOwnerId: ownerId, familyRole: "full" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
}

const notice = (n: FamilyNotice) => JSON.stringify(n);

/**
 * Removes `ownerId` from its family before the account is deleted.
 * With an heir: the family's data moves to them and the other accounts follow.
 * Without: every other account becomes independent (their own budget and
 * documents stay; the shared planning goes with the owner).
 */
export async function leaveFamilyBehind(ownerId: string, ownerName: string, heirId: string | null): Promise<void> {
  const others = await prisma.user.findMany({ where: { familyOwnerId: ownerId }, select: { id: true, name: true } });
  if (others.length === 0) return;

  if (!heirId) {
    await prisma.user.updateMany({
      where: { familyOwnerId: ownerId },
      data: { familyOwnerId: null, familyRole: "owner", familyNotice: notice({ kind: "detached", from: ownerName }) },
    });
    return;
  }

  const heir = others.find((u) => u.id === heirId)!;
  const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { foodHealthConsentAt: true } });
  const move = { where: { userId: ownerId }, data: { userId: heirId } };
  // Tables with one row per user (or per slot): the heir has none worth keeping,
  // since a full account works inside the owner's data.
  const clear = { where: { userId: heirId } };

  await prisma.$transaction([
    prisma.constraints.deleteMany(clear),
    prisma.shareLink.deleteMany(clear),
    prisma.meal.deleteMany(clear),
    prisma.categoryBudget.deleteMany(clear),
    prisma.importRule.deleteMany(clear),
    prisma.capAlert.deleteMany(clear),
    prisma.driftAlert.deleteMany(clear),
    prisma.familyMember.updateMany(move),
    prisma.task.updateMany(move),
    prisma.recipe.updateMany(move),
    prisma.meal.updateMany(move),
    prisma.document.updateMany(move),
    prisma.expense.updateMany(move),
    prisma.expenseCategory.updateMany(move),
    prisma.importRule.updateMany(move),
    prisma.categoryBudget.updateMany(move),
    prisma.recurringExpense.updateMany(move),
    prisma.shoppingItem.updateMany(move),
    prisma.constraints.updateMany(move),
    prisma.shareLink.updateMany(move),
    prisma.sharedPerson.updateMany(move),
    prisma.mealGeneration.updateMany(move),
    prisma.savingsGoal.updateMany(move),
    prisma.capAlert.updateMany(move),
    prisma.driftAlert.updateMany(move),
    prisma.starCompletion.updateMany(move),
    prisma.reward.updateMany(move),
    prisma.rewardRedemption.updateMany(move),
    // Seules les notes « Famille » passent à l'héritier ; les notes perso partent avec le compte.
    prisma.note.updateMany({ where: { userId: ownerId, shared: true }, data: { userId: heirId } }),
    prisma.familyInvite.deleteMany({ where: { ownerId } }),
    prisma.user.updateMany({
      where: { familyOwnerId: ownerId, id: { not: heirId } },
      data: { familyOwnerId: heirId, familyNotice: notice({ kind: "newOwner", from: ownerName, heir: heir.name }) },
    }),
    prisma.user.update({
      where: { id: heirId },
      data: {
        familyOwnerId: null,
        familyRole: "owner",
        foodHealthConsentAt: owner?.foodHealthConsentAt ?? null,
        familyNotice: notice({ kind: "heir", from: ownerName }),
      },
    }),
  ]);
}
