import { prisma } from "../db";
import { removeObjects } from "./storage";

// An account that already exists can join a family with a code. What it holds
// (its own planning, budget, documents) can't live next to the family's, so it
// has to be empty, or erased once the person has confirmed with their password.

export interface ContentCounts {
  members: number;
  tasks: number;
  recipes: number;
  meals: number;
  documents: number;
  expenses: number;
  shopping: number;
  savings: number;
  recurring: number;
  categories: number;
}

export const totalOf = (c: ContentCounts) => Object.values(c).reduce((a, b) => a + b, 0);

/** What the account has put in the app so far. */
export async function contentCounts(userId: string): Promise<ContentCounts> {
  const where = { userId };
  const [members, tasks, recipes, meals, documents, expenses, shopping, savings, recurring, categories] = await Promise.all([
    prisma.familyMember.count({ where }),
    prisma.task.count({ where }),
    prisma.recipe.count({ where }),
    prisma.meal.count({ where }),
    prisma.document.count({ where }),
    prisma.expense.count({ where }),
    prisma.shoppingItem.count({ where }),
    prisma.savingsGoal.count({ where }),
    prisma.recurringExpense.count({ where }),
    prisma.expenseCategory.count({ where }),
  ]);
  return { members, tasks, recipes, meals, documents, expenses, shopping, savings, recurring, categories };
}

/** Erases what the account holds (stored files included). The account itself stays. */
export async function eraseContent(userId: string): Promise<void> {
  const files = await prisma.document.findMany({ where: { userId }, select: { fileKey: true } });
  await removeObjects(files.map((f) => f.fileKey));
  const where = { userId };
  await prisma.$transaction([
    prisma.task.deleteMany({ where }),
    prisma.meal.deleteMany({ where }),
    prisma.document.deleteMany({ where }),
    prisma.expense.deleteMany({ where }),
    prisma.recurringExpense.deleteMany({ where }),
    prisma.savingsGoal.deleteMany({ where }),
    prisma.recipe.deleteMany({ where }),
    prisma.shoppingItem.deleteMany({ where }),
    prisma.expenseCategory.deleteMany({ where }),
    prisma.starCompletion.deleteMany({ where }),
    prisma.rewardRedemption.deleteMany({ where }),
    prisma.reward.deleteMany({ where }),
    prisma.categoryBudget.deleteMany({ where }),
    prisma.importRule.deleteMany({ where }),
    prisma.capAlert.deleteMany({ where }),
    prisma.notification.deleteMany({ where }),
    prisma.sharedPerson.deleteMany({ where }),
    prisma.shareLink.deleteMany({ where }),
    prisma.familyMember.deleteMany({ where }),
    // The family's own settings and calendar replace this account's.
    prisma.constraints.deleteMany({ where }),
    prisma.calendarConnection.deleteMany({ where }),
  ]);
}
