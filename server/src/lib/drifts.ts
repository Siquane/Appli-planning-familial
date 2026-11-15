import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { userHasBudgetPack } from "./plan";
import { categoryName } from "./expenseCategories";
import { pushToAccounts } from "./familyAlerts";

/**
 * Budget+ : « dérives » = une catégorie qui dépense nettement plus que
 * d'habitude. Le mois est comparé à la moyenne des 3 mois précédents ; il
 * faut +25 % ET +20 € pour ne pas alerter pour quelques euros. La catégorie
 * doit avoir servi au moins 2 de ces 3 mois (une dépense ponctuelle ou une
 * catégorie neuve ne fait pas une habitude). L'épargne n'est pas une dérive.
 */
export const DRIFT_MIN_RATIO = 1.25;
export const DRIFT_MIN_CENTS = 20_00;
const HISTORY_MONTHS = 3;
const IGNORED = new Set(["épargne"]);

export interface Drift {
  category: string;
  totalCents: number;
  averageCents: number;
  increaseCents: number;
  /** Hausse en %, arrondie. */
  increasePct: number;
}

type Totals = Map<string, number>;

/** Pure : dérives du mois `current` d'après les mois précédents (`history`). */
export function findDrifts(current: Totals, history: Totals[]): Drift[] {
  const drifts: Drift[] = [];
  for (const [category, totalCents] of current) {
    if (IGNORED.has(category)) continue;
    const past = history.map((h) => h.get(category) ?? 0);
    if (past.filter((c) => c > 0).length < 2) continue;
    const averageCents = Math.round(past.reduce((a, b) => a + b, 0) / history.length);
    const increaseCents = totalCents - averageCents;
    if (totalCents >= averageCents * DRIFT_MIN_RATIO && increaseCents >= DRIFT_MIN_CENTS) {
      drifts.push({ category, totalCents, averageCents, increaseCents, increasePct: Math.round((increaseCents * 100) / averageCents) });
    }
  }
  return drifts.sort((a, b) => b.increaseCents - a.increaseCents);
}

export function shiftMonthKey(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function range(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}

/** Dérives d'un mois (« AAAA-MM ») pour un espace budget. */
export async function getDrifts(userId: string, month: string): Promise<Drift[]> {
  const first = shiftMonthKey(month, -HISTORY_MONTHS);
  const expenses = await prisma.expense.findMany({
    where: { userId, date: { gte: range(first).gte, lt: range(month).lt } },
    select: { amountCents: true, category: true, date: true },
  });
  const totalsOf = (m: string): Totals => {
    const t: Totals = new Map();
    for (const e of expenses) if (e.date.toISOString().startsWith(m)) t.set(e.category, (t.get(e.category) ?? 0) + e.amountCents);
    return t;
  };
  const history = Array.from({ length: HISTORY_MONTHS }, (_, i) => totalsOf(shiftMonthKey(month, -(i + 1))));
  return findDrifts(totalsOf(month), history);
}

export interface DriftAlertInfo extends Drift {
  categoryName: string;
}

const euros = (cents: number) => `${Math.round(cents / 100)} €`;

export function driftMessage(d: DriftAlertInfo) {
  return `« ${d.categoryName} » : ${euros(d.totalCents)} ce mois-ci, +${d.increasePct} % par rapport à d'habitude (${euros(d.averageCents)}).`;
}

/**
 * Après l'enregistrement d'une dépense : si sa catégorie vient de dériver, une
 * seule fois par catégorie et par mois, note dans les notifications, alerte
 * push aux autres comptes qui partagent ce budget, et renvoie l'info à l'appli
 * (qui l'affiche à celui qui vient d'enregistrer).
 */
export async function checkDriftAlert(userId: string, category: string, month: string, actorId: string): Promise<DriftAlertInfo | null> {
  if (IGNORED.has(category)) return null;
  if (!(await userHasBudgetPack(userId))) return null;
  const drift = (await getDrifts(userId, month)).find((d) => d.category === category);
  if (!drift) return null;
  const info: DriftAlertInfo = { ...drift, categoryName: await categoryName(userId, category) };
  try {
    await prisma.$transaction([
      prisma.driftAlert.create({ data: { userId, category, month } }),
      prisma.notification.create({ data: { userId, title: `Dépenses en hausse — ${driftMessage(info)}` } }),
    ]);
  } catch (e) {
    // Déjà signalée ce mois-ci.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
  // Comptes qui voient ce budget : le propriétaire de l'espace et les comptes « complet » de sa famille.
  const accounts = await prisma.user.findMany({
    where: { OR: [{ id: userId }, { familyOwnerId: userId, familyRole: "full" }], NOT: { id: actorId } },
    select: { id: true },
  });
  pushToAccounts(
    accounts.map((a) => a.id),
    `Dépenses en hausse — ${driftMessage(info)}`,
    "/budget",
  ).catch((e) => console.error("Drift push failed:", e));
  return info;
}

export interface Debit {
  day: number;
  label: string;
  amountCents: number;
  category: string;
  passed: boolean;
}

/**
 * Calendrier des prélèvements d'un mois : les dépenses récurrentes, jour par
 * jour. Mois en cours ou passé : les copies réellement créées (montant modifié
 * ou mois sauté compris) ; mois à venir : les dépenses récurrentes prévues.
 */
export async function getDebits(userId: string, month: string, current: string, today: string) {
  let debits: Debit[];
  if (month <= current) {
    const copies = await prisma.expense.findMany({
      where: { userId, recurringId: { not: null }, date: range(month) },
      select: { label: true, amountCents: true, category: true, date: true },
    });
    debits = copies.map((e) => {
      const day = e.date.toISOString().slice(0, 10);
      return { day: Number(day.slice(8, 10)), label: e.label, amountCents: e.amountCents, category: e.category, passed: month < current || day <= today };
    });
  } else {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const planned = await prisma.recurringExpense.findMany({ where: { userId, startMonth: { lte: month } } });
    debits = planned.map((r) => ({ day: Math.min(r.dayOfMonth, last), label: r.label, amountCents: r.amountCents, category: r.category, passed: false }));
  }
  debits.sort((a, b) => a.day - b.day || b.amountCents - a.amountCents);
  const sum = (list: Debit[]) => list.reduce((a, d) => a + d.amountCents, 0);
  return { month, debits, passedCents: sum(debits.filter((d) => d.passed)), upcomingCents: sum(debits.filter((d) => !d.passed)) };
}
