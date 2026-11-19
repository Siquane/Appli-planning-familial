/** « de Léo », mais « d'Anaïs » / « d'Élise » devant un prénom qui commence par une voyelle. */
export function de(name: string): string {
  return /^[aeiouyàâäéèêëîïôöùûüœæ]/i.test(name.trim()) ? `d'${name.trim()}` : `de ${name.trim()}`;
}
