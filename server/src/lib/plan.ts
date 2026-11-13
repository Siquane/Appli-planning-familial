import type { Response } from "express";
import { prisma } from "../db";

// Free vs the two Premium packs ("Les 2" = both). Everything stays free except:
//   - documents: 20 free, unlimited with either pack
//   - menu generation: 4 weeks during the first month (trial), then 1 a
//     month; each free week comes with up to 15 « autre idée ».
//     Pack Menus: 12 weeks and 60 « autre idée » a month (a hidden safety cap).
//   - Pack Budget: savings goals, cap alerts, report, forecast, export.

export const FREE_DOCUMENT_LIMIT = 20;
export const TRIAL_DAYS = 30;
export const TRIAL_WEEKS = 4;
export const FREE_WEEKS_PER_MONTH = 1;
export const FREE_REROLLS_PER_WEEK = 15;
export const PREMIUM_WEEKS_PER_MONTH = 12;
export const PREMIUM_REROLLS_PER_MONTH = 60;

export type GenerationKind = "week" | "reroll";

export type Pack = "budget" | "meals";

type PackDates = { budgetUntil: Date | null; mealsUntil: Date | null };
const PACK_FIELD = { budget: "budgetUntil", meals: "mealsUntil" } as const;

export function hasPack(user: PackDates, pack: Pack, now = new Date()) {
  const until = user[PACK_FIELD[pack]];
  return !!until && until > now;
}

export function hasAnyPack(user: PackDates, now = new Date()) {
  return hasPack(user, "budget", now) || hasPack(user, "meals", now);
}

async function packDates(userId: string): Promise<PackDates | null> {
  return prisma.user.findUnique({ where: { id: userId }, select: { budgetUntil: true, mealsUntil: true } });
}

/** First instant of the current calendar month (UTC). */
export function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface MealQuota {
  /** "trial" during the first 30 days of a free account, "free" after, "premium" when subscribed. */
  period: "trial" | "free" | "premium";
  weeksUsed: number;
  weeksLimit: number;
  rerollsUsed: number;
  rerollsLimit: number;
  /** When the counters start again (end of trial or 1st of next month). */
  resetsAt: string;
}

export async function getMealQuota(userId: string, now = new Date()): Promise<MealQuota> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { budgetUntil: true, mealsUntil: true, createdAt: true } });
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const trialEnd = new Date(user.createdAt.getTime() + TRIAL_DAYS * 86_400_000);

  let period: MealQuota["period"];
  let since: Date;
  let resetsAt: Date;
  if (hasPack(user, "meals", now)) {
    period = "premium";
    since = monthStart(now);
    resetsAt = nextMonth;
  } else if (now < trialEnd) {
    period = "trial";
    since = user.createdAt;
    resetsAt = trialEnd;
  } else {
    period = "free";
    // Generations made during the trial don't eat into the month the trial ends in.
    since = new Date(Math.max(monthStart(now).getTime(), trialEnd.getTime()));
    resetsAt = nextMonth;
  }

  const rows = await prisma.mealGeneration.groupBy({
    by: ["kind"],
    where: { userId, createdAt: { gte: since } },
    _count: { _all: true },
  });
  const count = (kind: GenerationKind) => rows.find((r) => r.kind === kind)?._count._all ?? 0;
  const weeksUsed = count("week");
  const rerollsUsed = count("reroll");

  const weeksLimit = period === "premium" ? PREMIUM_WEEKS_PER_MONTH : period === "trial" ? TRIAL_WEEKS : FREE_WEEKS_PER_MONTH;
  // Free « autre idée » come with each week actually generated.
  const rerollsLimit = period === "premium" ? PREMIUM_REROLLS_PER_MONTH : FREE_REROLLS_PER_WEEK * weeksUsed;

  return { period, weeksUsed, weeksLimit, rerollsUsed, rerollsLimit, resetsAt: resetsAt.toISOString() };
}

/** French message explaining why this generation is refused, or null if allowed. */
export function quotaProblem(quota: MealQuota, kind: GenerationKind): string | null {
  if (kind === "week" && quota.weeksUsed >= quota.weeksLimit) {
    if (quota.period === "premium") return "Tu as atteint la limite de générations de ce mois-ci. Elle repart le 1er du mois.";
    return quota.period === "trial"
      ? "Tes 4 générations d'essai sont utilisées. Le pack Menus permet de générer tes menus chaque semaine."
      : "Ta génération gratuite du mois est utilisée. Le pack Menus permet de générer tes menus chaque semaine.";
  }
  if (kind === "reroll" && quota.rerollsUsed >= quota.rerollsLimit) {
    return quota.period === "premium"
      ? "Tu as atteint la limite d'« autre idée » de ce mois-ci."
      : "Plus d'« autre idée » disponible pour cette semaine. Le pack Menus en donne davantage.";
  }
  return null;
}

/** Documents are unlimited with either pack. */
export async function hasUnlimitedDocuments(userId: string) {
  const user = await packDates(userId);
  return !!user && hasAnyPack(user);
}

/** Answers 403 `premium_required` and returns false when the user doesn't have the Budget pack. */
export async function requireBudgetPack(userId: string, res: Response, feature: string): Promise<boolean> {
  const user = await packDates(userId);
  if (user && hasPack(user, "budget")) return true;
  res.status(403).json({ error: `${feature} fait partie du pack Budget.`, code: "premium_required", pack: "budget" });
  return false;
}

export async function userHasBudgetPack(userId: string) {
  const user = await packDates(userId);
  return !!user && hasPack(user, "budget");
}
