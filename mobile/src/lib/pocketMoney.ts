import type { PocketMoneyRule } from "../api/types";
import { formatEuros } from "./money";
import { WEEKDAYS_FULL } from "./weekdays";
import { appointmentDayLabel } from "./appointments";

/** « 5,00 € chaque samedi » / « 20,00 € le 1er de chaque mois ». */
export function ruleLabel(rule: Pick<PocketMoneyRule, "amountCents" | "frequency" | "day">): string {
  const amount = formatEuros(rule.amountCents);
  if (rule.frequency === "weekly") return `${amount} chaque ${WEEKDAYS_FULL[rule.day].toLowerCase()}`;
  return `${amount} le ${rule.day === 1 ? "1er" : rule.day} de chaque mois`;
}

/** « Prochain versement : sam. 21 nov. » */
export function nextLabel(rule: Pick<PocketMoneyRule, "nextDay">): string {
  return `Prochain versement : ${appointmentDayLabel(rule.nextDay)}`;
}
