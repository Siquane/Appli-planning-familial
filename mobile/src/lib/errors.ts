// Messages shown when something fails: what happened, and what to do.

/** Message for an HTTP error the server didn't explain. */
export function statusMessage(status: number): string {
  if (status === 401) return "Session expirée, reconnecte-toi.";
  if (status === 403) return "Tu n'as pas accès à cette action.";
  if (status === 404) return "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran.";
  if (status === 413) return "Fichier trop lourd. Choisis un fichier plus petit.";
  if (status === 429) return "Trop de demandes d'un coup. Réessaie dans une minute.";
  if (status >= 500) return "Le serveur rencontre un souci. Réessaie dans un instant.";
  return "La demande n'a pas abouti. Vérifie ce que tu as saisi et réessaie.";
}

export const OFFLINE_MESSAGE = "Pas de connexion au serveur. Vérifie ta connexion internet et réessaie.";

/**
 * The message of `e` when it carries one meant for people (our ApiErrors and
 * thrown Errors do), otherwise « Impossible de <action>. Réessaie. ».
 */
export function errorText(e: unknown, action: string): string {
  if (e instanceof Error && e.message && !/network request failed|failed to fetch|load failed/i.test(e.message)) return e.message;
  if (e instanceof Error) return OFFLINE_MESSAGE;
  const de = /^[aeiouyéèêàâîôûh]/i.test(action) ? "d'" : "de ";
  return `Impossible ${de}${action}. Réessaie.`;
}
