import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { userHasBudgetPack } from "./plan";
import { categoryName as nameOf } from "./expenseCategories";

// Premium: when a category reaches 80 % then 100 % of its monthly cap, the
// family gets an in-app notification (once per level, category and month),
// and the app shows it right away after saving the expense.

export const ALERT_LEVELS = [100, 80] as const;

export interface CapAlertInfo {
  category: string;
  categoryName: string;
  level: (typeof ALERT_LEVELS)[number];
  totalCents: number;
  limitCents: number;
}

const euros = (cents: number) => `${Math.round(cents / 100)} €`;

/** The single highest newly-crossed level, or null. Pure, for tests. */
export function crossedLevel(totalCents: number, limitCents: number, alreadyRaised: number[]): 80 | 100 | null {
  for (const level of ALERT_LEVELS) {
    if (totalCents * 100 >= limitCents * level) return alreadyRaised.includes(level) ? null : level;
  }
  return null;
}

/** Checks the cap of `category` for `month` ("YYYY-MM") and raises an alert if one was just crossed. */
export async function checkCapAlert(userId: string, category: string, month: string): Promise<CapAlertInfo | null> {
  const budget = await prisma.categoryBudget.findUnique({ where: { userId_category: { userId, category } } });
  if (!budget) return null;
  if (!(await userHasBudgetPack(userId))) return null;

  const [y, m] = month.split("-").map(Number);
  const [sum, raised] = await Promise.all([
    prisma.expense.aggregate({
      where: { userId, category, date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } },
      _sum: { amountCents: true },
    }),
    prisma.capAlert.findMany({ where: { userId, category, month }, select: { level: true } }),
  ]);
  const totalCents = sum._sum.amountCents ?? 0;
  const level = crossedLevel(totalCents, budget.limitCents, raised.map((r) => r.level));
  if (!level) return null;

  const categoryName = await nameOf(userId, category);

  try {
    // Reaching 100 % at once also marks 80 % as done, so it never fires afterwards.
    const levels = ALERT_LEVELS.filter((l) => l <= level && !raised.some((r) => r.level === l));
    await prisma.$transaction([
      ...levels.map((l) => prisma.capAlert.create({ data: { userId, category, month, level: l } })),
      prisma.notification.create({
        data: {
          userId,
          title:
            level === 100
              ? `Plafond « ${categoryName} » atteint : ${euros(totalCents)} sur ${euros(budget.limitCents)}`
              : `« ${categoryName} » à ${Math.floor((totalCents * 100) / budget.limitCents)} % du plafond : ${euros(totalCents)} sur ${euros(budget.limitCents)}`,
        },
      }),
    ]);
  } catch (e) {
    // Two saves at the same moment: the other one raised it.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
  return { category, categoryName, level, totalCents, limitCents: budget.limitCents };
}
