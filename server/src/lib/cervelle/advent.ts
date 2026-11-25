// Calendrier de l'Avent de Cervelle : 24 cases, du 1er au 24 décembre. Une
// case s'ouvre avec une révision : chaque jour de révision (du 1er décembre
// au 6 janvier) donne une clé, deux si l'enfant a fait au moins deux
// révisions ce jour-là, ce qui permet de rattraper une case oubliée. Une case
// ne s'ouvre qu'à partir de son jour. Derrière : un accessoire de Noël pour
// Cervelle, des étoiles bonus pour le chemin d'étoiles, ou un défi du jour.
// Pur : la route rassemble les faits.

import { daysBetween } from "./days";

export type AdventReward =
  | { type: "item"; item: string }
  | { type: "stars"; stars: number }
  | { type: "defi"; stars: number; text: string };

/** Étoiles en plus d'un défi : le défi lui-même n'est pas vérifié. */
const DEFI_STARS = 2;
const defi = (text: string): AdventReward => ({ type: "defi", stars: DEFI_STARS, text });
const stars = (n: number): AdventReward => ({ type: "stars", stars: n });
const item = (id: string): AdventReward => ({ type: "item", item: id });

/** Cases 1 à 24 (index 0 = 1er décembre). Les accessoires tous les 4 jours, le plus beau le 24. */
export const ADVENT: AdventReward[] = [
  stars(3),
  defi("Explique à quelqu'un de ta famille une chose que tu as apprise aujourd'hui."),
  stars(3),
  item("nez_renne"),
  defi("Écris 3 mots nouveaux que tu as appris cette semaine."),
  stars(5),
  defi("Pose une question de ta révision à un adulte. Est-ce qu'il sait répondre ?"),
  item("sucre_orge"),
  stars(3),
  defi("Dessine ce que tu as révisé aujourd'hui."),
  stars(3),
  item("bois_renne"),
  defi("Lis ta fiche à voix haute, comme un présentateur de télé."),
  stars(5),
  defi("Trouve dans la maison un objet qui a un lien avec ta leçon."),
  item("echarpe_noel"),
  stars(3),
  defi("Invente une devinette sur ce que tu as appris."),
  stars(3),
  item("bonnet_lutin"),
  defi("Raconte ta leçon en 3 phrases seulement."),
  stars(5),
  defi("Dis merci à quelqu'un qui t'a aidé à apprendre cette année."),
  item("cape_noel"),
];

export const ADVENT_DAYS = ADVENT.length;
/** Le calendrier se montre (fermé) à partir de cette date… */
const PREVIEW_FROM = "11-20";
/** …et les cases oubliées se rattrapent jusqu'à celle-ci (Épiphanie). */
const LAST_DAY = "01-06";

export type AdventPhase = "bientot" | "ouvert" | "rattrapage";

/** L'année du calendrier visible le `today` (« YYYY-MM-DD »), ou null hors saison. */
export function adventYear(today: string): number | null {
  const y = Number(today.slice(0, 4));
  const md = today.slice(5);
  if (md >= PREVIEW_FROM) return y;
  if (md <= LAST_DAY) return y - 1;
  return null;
}

export function adventPhase(year: number, today: string): AdventPhase {
  if (today < `${year}-12-01`) return "bientot";
  if (today <= `${year}-12-${ADVENT_DAYS}`) return "ouvert";
  return "rattrapage";
}

/** Date de la case `n` (1 à 24). */
export const cellDate = (year: number, n: number) => `${year}-12-${String(n).padStart(2, "0")}`;

/** Fenêtre où les révisions comptent : du 1er décembre au 6 janvier. */
export function keyWindow(year: number) {
  return { from: `${year}-12-01`, to: `${year + 1}-${LAST_DAY}` };
}

/**
 * Clés gagnées jusqu'à `today` : par jour de révision, une clé, deux à partir
 * de deux révisions. `sessionsByDay` : nombre de révisions (de longueur > 0) par jour.
 */
export function keysOf(sessionsByDay: Record<string, number>, year: number, today: string): number {
  const { from, to } = keyWindow(year);
  let keys = 0;
  for (const [day, n] of Object.entries(sessionsByDay)) {
    if (day < from || day > to || day > today || n <= 0) continue;
    keys += Math.min(2, n);
  }
  return keys;
}

export interface AdventCell {
  day: number;
  date: string;
  opened: boolean;
  /** Son jour est arrivé (même s'il manque une clé). */
  arrived: boolean;
  /** S'ouvre maintenant si on la touche. */
  openable: boolean;
}

export function adventCells(year: number, today: string, opened: Set<number>, keys: number): AdventCell[] {
  const { to } = keyWindow(year);
  const left = keys - opened.size;
  return ADVENT.map((_, i) => {
    const day = i + 1;
    const date = cellDate(year, day);
    const arrived = date <= today && today <= to;
    return { day, date, opened: opened.has(day), arrived, openable: arrived && !opened.has(day) && left > 0 };
  });
}

/** Jours avant le 1er décembre (0 le jour même et après). */
export function daysUntilStart(year: number, today: string): number {
  return Math.max(0, daysBetween(today, `${year}-12-01`));
}

/** Les accessoires du calendrier, dans l'ordre des cases. */
export const ADVENT_ITEMS = ADVENT.flatMap((r, i) => (r.type === "item" ? [{ day: i + 1, item: r.item }] : []));
