import { router } from "expo-router";
import { needsPremium } from "../api/client";
import { useToastStore } from "../state/toastStore";
import type { MealQuota, Plan } from "../api/types";

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
  useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
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
