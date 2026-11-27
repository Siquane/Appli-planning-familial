// Messages shown when something fails: what happened, and what to do.

/** Message for an HTTP error the server didn't explain. */
export function statusMessage(status: number): string {
  if (status === 401) return "Session expirée, reconnecte-toi.";
  if (status === 403) return "Ton accès ne permet pas de faire ça. Demande au créateur de la famille.";
  if (status === 404) return "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran.";
  if (status === 413) return "Fichier trop lourd. Choisis un fichier plus petit.";
  if (status === 429) return "Trop de demandes d'un coup. Réessaie dans une minute.";
  if (status >= 500) return "Le serveur rencontre un souci. Réessaie dans un instant.";
  return "Une information n'est pas valable. Vérifie ce que tu as saisi et réessaie.";
}

export const OFFLINE_MESSAGE = "Pas de connexion au serveur. Vérifie ta connexion internet et réessaie.";

/**
 * The message of `e` when it carries one meant for people (our ApiErrors and
 * thrown Errors do), otherwise « Impossible de <action>. Réessaie. ».
 */
export function errorText(e: unknown, action: string): string {
  if (e instanceof Error && e.message && !/network request failed|failed to fetch|load failed/i.test(e.message) && !isTechnical(e.message)) return e.message;
  if (e instanceof Error) return OFFLINE_MESSAGE;
  const de = /^[aeiouyéèêàâîôûh]/i.test(action) ? "d'" : "de ";
  return `Impossible ${de}${action}. Réessaie.`;
}

/**
 * Un message technique ou en anglais (« Not found », « Invalid token »,
 * « Unexpected token < in JSON »…) : jamais affiché tel quel.
 */
export function isTechnical(message: string): boolean {
  return /^(not found|unauthorized|forbidden|invalid|missing|no route|internal|bad request|unexpected|cannot|failed|error\b)/i.test(message.trim()) || /\b(token|undefined|null|json|status code)\b/i.test(message);
}
