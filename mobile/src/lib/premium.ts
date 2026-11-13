import { router } from "expo-router";
import { needsPremium } from "../api/client";
import { useToastStore } from "../state/toastStore";
import type { MealQuota } from "../api/types";

export const PREMIUM_PRICE_MONTH = "2,99 €";
export const PREMIUM_PRICE_YEAR = "19,99 €";

/**
 * Shows the error. When it's a Premium wall (feature or quota), also opens the
 * Premium screen so the explanation and the offer are one tap away.
 */
export function showApiError(e: unknown) {
  useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
  if (needsPremium(e)) router.push("/premium");
}

/** "3 génération(s) restante(s)…" line under the menu generator button. */
export function mealQuotaLabel(q: MealQuota): string {
  const left = Math.max(0, q.weeksLimit - q.weeksUsed);
  if (q.period === "premium") return `Premium : ${left} génération${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""} ce mois-ci.`;
  const plural = left > 1 ? "s" : "";
  const when = q.period === "trial" ? "pendant ton premier mois" : "ce mois-ci";
  return left > 0 ? `${left} génération${plural} gratuite${plural} ${when}.` : `Génération gratuite utilisée ${when}.`;
}
