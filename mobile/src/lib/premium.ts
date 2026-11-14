import { router } from "expo-router";
import { needsPremium } from "../api/client";
import { useToastStore } from "../state/toastStore";
import type { MealQuota, Plan } from "../api/types";
import { errorText } from "./errors";

// Two offers, Repas+ and Budget+, or both (Passerelle+) at a lower price. Prices are shown in the
// app only; the store products will carry the real ones.
export const PACKS = [
  {
    id: "budget",
    name: "Budget+",
    month: "1,99 €",
    year: "14,99 €",
    features: [
      "Objectifs d'épargne avec jauge",
      "Alertes à 80 % et 100 % des plafonds",
      "Bilan sur 6 mois et prévision de fin de mois",
      "Export CSV et PDF (impôts, CAF, prêt)",
      "Import de relevés bancaires (PDF)",
      "Documents illimités",
    ],
  },
  {
    id: "meals",
    name: "Repas+",
    month: "2,99 €",
    year: "19,99 €",
    features: ["Menus générés chaque semaine", "Des « autre idée » pour ajuster chaque repas", "Documents illimités"],
  },
  {
    id: "both",
    name: "Passerelle+",
    month: "3,99 €",
    year: "29,99 €",
    features: ["Tout Repas+", "Tout Budget+", "Moins cher que les deux séparés"],
  },
] as const;

export const hasBudgetPack = (plan: Plan | undefined) => !!plan?.packs.budget.active;
export const hasMealsPack = (plan: Plan | undefined) => !!plan?.packs.meals.active;
export const hasAnyPack = (plan: Plan | undefined) => hasBudgetPack(plan) || hasMealsPack(plan);

/**
 * Shows the error. When it's a Premium wall (feature or quota), also opens the
 * Premium screen so the explanation and the offer are one tap away.
 */
export function showApiError(e: unknown) {
  useToastStore.getState().show(errorText(e, "terminer cette action"));
  if (needsPremium(e)) router.push("/premium");
}

/** "3 générations gratuites…" line under the menu generator button. */
export function mealQuotaLabel(q: MealQuota): string {
  const left = Math.max(0, q.weeksLimit - q.weeksUsed);
  if (q.period === "premium") return `Repas+ : ${left} génération${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} ce mois-ci.`;
  const plural = left > 1 ? "s" : "";
  const when = q.period === "trial" ? "pendant ton premier mois" : "ce mois-ci";
  return left > 0 ? `${left} génération${plural} gratuite${plural} ${when}.` : `Génération gratuite utilisée ${when}.`;
}

/** « à vie » for the family's lifetime accounts (far-future date), else « jusqu'au 12 déc. 2027 ». */
export function packUntilLabel(until: string | null): string {
  if (!until) return "";
  const d = new Date(until);
  if (d.getFullYear() >= 2900) return "à vie";
  return `jusqu'au ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
}

// ---------------------------------------------------------------------------
// Budget+ free trial.

const DAY_MS = 86_400_000;
/** The reminder comes this many days before the trial ends. */
export const TRIAL_REMINDER_DAYS = 5;

export const budgetTrial = (plan: Plan | undefined) => plan?.packs.budget.trial;

/** Days left, counting the current one: 28 on the first day, 1 on the last, 0 once over. */
export function trialDaysLeft(endsAt: string | null | undefined, now: Date = new Date()): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now.getTime()) / DAY_MS));
}

/** True when a paid pack (or lifetime) is running, not just the trial. */
export function hasPaidPack(plan: Plan | undefined): boolean {
  if (!plan) return false;
  return (plan.packs.budget.active && !plan.packs.budget.trial?.active) || plan.packs.meals.active;
}

export type TrialNotice = { kind: "offer"; text: string } | { kind: "running" | "ending"; text: string; daysLeft: number };

/** The line shown on the Budget tab about the trial, or null when there's nothing to say. */
export function trialNotice(plan: Plan | undefined, now: Date = new Date()): TrialNotice | null {
  const trial = budgetTrial(plan);
  if (!trial) return null;
  if (trial.active) {
    const daysLeft = trialDaysLeft(trial.endsAt, now);
    const unit = `jour${daysLeft > 1 ? "s" : ""}`;
    return daysLeft <= TRIAL_REMINDER_DAYS
      ? { kind: "ending", daysLeft, text: `Plus que ${daysLeft} ${unit} d'essai gratuit de Budget+.` }
      : { kind: "running", daysLeft, text: `Essai gratuit de Budget+ : il reste ${daysLeft} ${unit}.` };
  }
  if (trial.available) return { kind: "offer", text: `Essaie Budget+ gratuitement pendant ${trial.days / 7} semaines.` };
  return null;
}

/** Link text on the Budget+ teasers: « Essayer … » while the trial is on offer. */
export function budgetOfferLabel(plan: Plan | undefined): string {
  const trial = budgetTrial(plan);
  return trial?.available ? `Essayer ${trial.days / 7} semaines gratuitement` : "Voir Budget+";
}

/** When to remind that the trial is about to end: 10:00, TRIAL_REMINDER_DAYS before it ends. Null if that moment has passed. */
export function trialReminderDate(endsAt: string | null | undefined, now: Date = new Date()): Date | null {
  if (!endsAt) return null;
  const date = new Date(Date.parse(endsAt) - TRIAL_REMINDER_DAYS * DAY_MS);
  date.setHours(10, 0, 0, 0);
  return date.getTime() > now.getTime() ? date : null;
}
