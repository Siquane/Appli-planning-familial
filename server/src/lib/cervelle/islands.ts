// « Carte au trésor » : chaque matière est une île couverte de brouillard.
// Chaque notion maîtrisée (pour la première fois) en dévoile un lieu ; une île
// a 12 lieux. Une île entièrement explorée donne un coffre (pièces, parfois un
// objet) et le badge d'explorateur de l'île ; la première île donne aussi le
// chapeau de pirate, la troisième le décor « Île au trésor ». Ce qu'on a
// appris compte, jamais la note. Pur : la route rassemble les notions.

export const SPOTS = 12;
export const ISLAND_COINS = 50;
export const PIRATE_HAT = "chapeau_pirate";
export const TREASURE_DECOR = "ile_tresor";
/** Îles complètes pour le décor. */
export const DECOR_AFTER = 3;

export interface IslandDef {
  id: string;
  name: string;
  /** Matières (texte libre de la révision) qui vont sur cette île ; la première qui correspond gagne. */
  match: RegExp | null;
}

export const ISLANDS: IslandDef[] = [
  { id: "maths", name: "Île des Nombres", match: /math|calcul|g[ée]om[ée]tr|alg[èe]b|arithm|num[ée]ra/i },
  { id: "francais", name: "Île des Mots", match: /fran[cç]|lecture|grammaire|orthograph|conjug|litt[ée]r|po[ée]s|vocab|r[ée]daction/i },
  { id: "histoire", name: "Île du Temps", match: /hist|g[ée]o|emc|moral|civi|questionner le monde/i },
  { id: "sciences", name: "Île des Découvertes", match: /svt|physique|chimie|scien|techno|biolog|vivant|nature|astronom/i },
  { id: "langues", name: "Île des Langues", match: /angl|espagn|allem|ital|langue|latin|grec|english|chinois|portug|arabe/i },
  { id: "talents", name: "Île des Talents", match: /musique|\barts?\b|plastique|dessin|eps|sport|th[ée][âa]tre|danse/i },
  { id: "mystere", name: "Île Mystère", match: null },
];

/** L'île d'une révision, d'après sa matière (puis son titre si la matière est vide). */
export function islandOf(subject: string, title = ""): string {
  const text = subject.trim() || title;
  return ISLANDS.find((i) => i.match?.test(text))?.id ?? "mystere";
}

export interface FoundNotion {
  title: string;
  subject: string;
  revisionTitle: string;
  masteredAt: Date;
}

export interface IslandView {
  id: string;
  name: string;
  /** Lieux dévoilés (au plus SPOTS). */
  explored: number;
  spots: number;
  complete: boolean;
  /** Notions maîtrisées sur l'île, au-delà des 12 lieux aussi. */
  mastered: number;
  /** Les lieux dévoilés : les premières notions maîtrisées, dans l'ordre. */
  found: { title: string; revisionTitle: string }[];
}

export function islandsOf(found: FoundNotion[]): IslandView[] {
  const sorted = [...found].sort((a, b) => a.masteredAt.getTime() - b.masteredAt.getTime());
  return ISLANDS.map((def) => {
    const mine = sorted.filter((n) => islandOf(n.subject, n.revisionTitle) === def.id);
    const explored = Math.min(SPOTS, mine.length);
    return {
      id: def.id,
      name: def.name,
      explored,
      spots: SPOTS,
      complete: mine.length >= SPOTS,
      mastered: mine.length,
      found: mine.slice(0, SPOTS).map((n) => ({ title: n.title, revisionTitle: n.revisionTitle })),
    };
  });
}

export const islandName = (id: string) => ISLANDS.find((i) => i.id === id)?.name ?? id;
