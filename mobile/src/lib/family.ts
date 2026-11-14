import type { FamilyNotice, FamilyRole } from "../api/types";

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

/** What a member reads at the next opening after the family changed hands. Gentle, and says what is kept. */
export function noticeText(notice: FamilyNotice): { title: string; body: string; offers: boolean } {
  switch (notice.kind) {
    case "heir":
      return {
        title: "Tu gères maintenant la famille",
        body: `${notice.from} a quitté Passerelle et t'a confié le planning, avec le budget et les documents de la famille. Rien n'a été perdu. Pour que chacun garde les options payantes, pense à prendre ton propre abonnement.`,
        offers: true,
      };
    case "newOwner":
      return {
        title: `${notice.heir} gère maintenant la famille`,
        body: `${notice.from} a quitté Passerelle. Ton compte, ton planning et tes données sont intacts : ${notice.heir} reprend la famille. Les options payantes (Repas+, Budget+) dépendent désormais de son abonnement.`,
        offers: false,
      };
    case "detached":
      return {
        title: "Ton compte continue",
        body: `${notice.from} a quitté Passerelle et personne n'a pu reprendre le planning partagé. Ton compte, ton budget et tes documents personnels sont conservés. Tu peux créer ta propre famille, ou en rejoindre une avec un code.`,
        offers: false,
      };
  }
}

export interface HeirChoice {
  id: string;
  name: string;
}

/** The adults who could take the family over, from the server's answer when the owner deletes their account. */
export function parseHeirs(details: unknown): HeirChoice[] {
  const heirs = (details as { heirs?: unknown } | null | undefined)?.heirs;
  if (!Array.isArray(heirs)) return [];
  return heirs.filter((h): h is HeirChoice => !!h && typeof h.id === "string" && typeof h.name === "string");
}

/** What an existing account holds, as the server counts it before joining a family. */
export type ContentCounts = Partial<Record<"members" | "tasks" | "recipes" | "meals" | "documents" | "expenses" | "shopping" | "savings" | "recurring" | "categories", number>>;

const COUNT_LABELS: [keyof ContentCounts, string, string][] = [
  ["members", "membre", "membres"],
  ["tasks", "tâche", "tâches"],
  ["meals", "repas", "repas"],
  ["recipes", "recette", "recettes"],
  ["shopping", "article de courses", "articles de courses"],
  ["expenses", "dépense", "dépenses"],
  ["recurring", "dépense récurrente", "dépenses récurrentes"],
  ["savings", "objectif d'épargne", "objectifs d'épargne"],
  ["documents", "document", "documents"],
  ["categories", "catégorie", "catégories"],
];

/** « 3 tâches, 1 dépense et 2 documents », or null when there is nothing. */
export function describeContent(counts: ContentCounts | undefined | null): string | null {
  const parts = COUNT_LABELS.flatMap(([key, one, many]) => {
    const n = counts?.[key] ?? 0;
    return n > 0 ? [`${n} ${n > 1 ? many : one}`] : [];
  });
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}
