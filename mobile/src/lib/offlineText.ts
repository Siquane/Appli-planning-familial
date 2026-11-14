/** What the strip at the top says, or null when there is nothing to say. */
export function offlineBannerText(online: boolean, waiting: number): string | null {
  if (!online) {
    const base = "Hors connexion : tu peux tout consulter et modifier ton planning, tes courses, tes repas et ton budget.";
    if (waiting === 0) return `${base} Menus générés, relevés, documents et achats reviennent avec le réseau.`;
    return `${base} ${waiting === 1 ? "1 changement part" : `${waiting} changements partent`} dès le retour du réseau.`;
  }
  if (waiting > 0) return waiting === 1 ? "Envoi de 1 changement…" : `Envoi de ${waiting} changements…`;
  return null;
}
