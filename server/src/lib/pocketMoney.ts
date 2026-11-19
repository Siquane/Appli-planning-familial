import { prisma } from "../db";
import { addDays, parisDay, weekdayOf } from "./cervelle/days";

// Argent de poche d'un enfant : jours de versement d'une règle, et création
// paresseuse des versements automatiques (à la lecture, comme les dépenses
// récurrentes : pas de tâche programmée sur l'hébergement gratuit).

export type Frequency = "weekly" | "monthly";

export interface Rule {
  amountCents: number;
  frequency: Frequency;
  /** weekly : 0 = lundi … 6 = dimanche ; monthly : 1 à 28. */
  day: number;
  startDay: string;
}

/** Au plus autant de versements rattrapés d'un coup (appli pas ouverte pendant longtemps). */
const MAX_CATCH_UP = 60;

function isPayDay(rule: Pick<Rule, "frequency" | "day">, day: string): boolean {
  return rule.frequency === "weekly" ? weekdayOf(day) === rule.day : Number(day.slice(8, 10)) === rule.day;
}

/** Jours de versement entre `from` et `to` inclus (« AAAA-MM-JJ »), au plus `limit`. */
export function payDays(rule: Pick<Rule, "frequency" | "day">, from: string, to: string, limit = MAX_CATCH_UP): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < limit; d = addDays(d, 1)) {
    if (isPayDay(rule, d)) out.push(d);
  }
  return out;
}

/** Le prochain jour de versement à partir de `from` inclus. */
export function nextPayDay(rule: Pick<Rule, "frequency" | "day">, from: string): string {
  return payDays(rule, from, addDays(from, 40), 1)[0];
}

/** Crée les versements automatiques dus jusqu'à aujourd'hui (heure de Paris). */
export async function catchUpPocketMoney(accountId: string, today: string = parisDay()): Promise<void> {
  // Verrou par compte : deux lectures simultanées ne créent pas deux fois le même versement.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pocket:${accountId}`}))`;
    const rule = await tx.pocketMoneyRule.findUnique({ where: { accountId } });
    if (!rule) return;
    const last = await tx.pocketMoneyCredit.findFirst({ where: { accountId, source: "auto" }, orderBy: { day: "desc" }, select: { day: true } });
    const from = last && last.day >= rule.startDay ? addDays(last.day, 1) : rule.startDay;
    const days = payDays(rule as Rule, from, today);
    if (days.length === 0) return;
    await tx.pocketMoneyCredit.createMany({
      data: days.map((day) => ({ accountId, amountCents: rule.amountCents, label: "Argent de poche", day, source: "auto" })),
    });
  });
}
