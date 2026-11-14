import type { FamilyRole } from "../api/types";

// Words and small rules of the « Comptes de la famille » screen.

export const ROLE_LABEL: Record<FamilyRole, string> = { owner: "Créateur", full: "Complet", planning: "Planning" };

export const ROLE_EXPLANATION = {
  full: "Partage tout avec toi : planning, repas, budget et documents. Pour un conjoint avec qui tu gères tout ensemble.",
  planning: "Partage le planning (tâches, repas, courses, recettes) mais garde son propre budget et ses propres documents. Pour un conjoint ou un ado.",
} as const;

const DAY_MS = 86_400_000;

/** "valable encore 6 jours" / "expire aujourd'hui" / "expiré". */
export function inviteValidity(expiresAt: string, now: Date = new Date()): string {
  const left = Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS);
  if (left <= 0) return Date.parse(expiresAt) > now.getTime() ? "expire aujourd'hui" : "expiré";
  return left === 1 ? "valable encore 1 jour" : `valable encore ${left} jours`;
}

/** The message sent with the code. */
export function shareMessage(code: string, ownerName: string, expiresAt: string, now: Date = new Date()): string {
  const left = Math.max(1, Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS));
  return `${ownerName} t'invite à rejoindre sa famille sur Passerelle. Installe l'appli, choisis « J'ai un code famille » à la création du compte et saisis : ${code} (valable ${left} jour${left > 1 ? "s" : ""}).`;
}

/** What the screen says to someone who joined. */
export function joinedSummary(role: FamilyRole, ownerName: string | null): string {
  const who = ownerName ? `la famille de ${ownerName}` : "une famille";
  return role === "planning"
    ? `Tu fais partie de ${who} avec le profil Planning : tu partages le planning, et ton budget et tes documents restent à toi.`
    : `Tu fais partie de ${who} avec le profil Complet : tu partages tout, budget et documents compris.`;
}
