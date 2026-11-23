// « Chemin d'étoiles »: each month a new path of 100 squares, one every 5
// stars (500 to finish). Stars come from revising, the daily missions,
// regularity, duels and badges; every 5 squares a reward (coins, a surprise
// chest), and at the end an exclusive item and the path's badge. Pure: the
// route gathers the month's facts.

import { addDays, daysBetween } from "./days";

export const SQUARES = 100;
export const STARS_PER_SQUARE = 5;
export const PATH_END = SQUARES * STARS_PER_SQUARE;
/** A reward every this many squares. */
const REWARD_EVERY = 5;

export type Reward = { type: "coins"; coins: number } | { type: "chest" } | { type: "item" } | { type: "none" };

/**
 * The 100 squares of every month's path. Every 5th square gives something,
 * coins and surprise chests in turn (coins growing along the path); the last
 * one, the month's exclusive item.
 */
export const STEPS: { at: number; reward: Reward }[] = Array.from({ length: SQUARES }, (_, i) => {
  const square = i + 1;
  const at = square * STARS_PER_SQUARE;
  if (square === SQUARES) return { at, reward: { type: "item" } };
  if (square % REWARD_EVERY !== 0) return { at, reward: { type: "none" } };
  const n = square / REWARD_EVERY; // 1 … 19
  return { at, reward: n % 2 === 1 ? { type: "coins", coins: 10 + 5 * Math.floor(n / 2) * 2 } : { type: "chest" } };
});

/** Monthly themes, in turn; each has its exclusive item (shop id, kind « chemin »). */
export const THEMES = [
  { id: "espace", label: "Direction les étoiles", item: "casque_astronaute" },
  { id: "ocean", label: "Plongée dans l'océan", item: "tuba" },
  { id: "jungle", label: "Aventure dans la jungle", item: "couronne_feuilles" },
  { id: "nuit", label: "Nuit étoilée", item: "cape_etoiles" },
] as const;

export function themeOf(month: string) {
  const [y, m] = month.split("-").map(Number);
  return THEMES[(y * 12 + (m - 1)) % THEMES.length];
}

/** First and last day of « YYYY-MM ». */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: `${month}-01`, to: addDays(next, -1) };
}

export interface MonthFacts {
  /** Quiz sessions (QCM, cartes, à revoir, express): their mode and length. */
  quizzes: { mode: string; total: number }[];
  /** Interros of Cervelle done. */
  interros: number;
  /** Days with revision this month (any order, duplicates allowed). */
  studyDays: string[];
  /** Days the missions' chest was opened. */
  chests: number;
  /** Quiz duels where they progressed, and weekly challenges won (time worked). */
  wins: number;
  /** Badges earned this month. */
  badges: number;
}

export const STAR_RULES = {
  /** Half a star a quiz (the month's half stars are added up, then rounded down). */
  quiz: 0.5,
  /** Effort bonus: going over one's mistakes (« à revoir ») or a long session (10 questions or more). */
  effort: 0.5,
  interro: 2,
  day: 1,
  week: 5,
  chest: 3,
  win: 3,
  badge: 2,
} as const;

/** Longest runs of consecutive days → one bonus per full 7 days. */
function weekBonuses(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let run = 0;
  let weeks = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && daysBetween(sorted[i - 1], d) === 1 ? run + 1 : 1;
    if (run % 7 === 0) weeks++;
  });
  return weeks;
}

export function starsOf(f: MonthFacts) {
  // Effort, not marks: the bonus rewards reviewing mistakes or a long session, never a score.
  const quizStars = Math.floor(f.quizzes.reduce((n, q) => n + STAR_RULES.quiz + (q.mode === "a_revoir" || q.total >= 10 ? STAR_RULES.effort : 0), 0));
  const revision = quizStars + f.interros * STAR_RULES.interro;
  const regularite = new Set(f.studyDays).size * STAR_RULES.day + weekBonuses(f.studyDays) * STAR_RULES.week;
  const missions = f.chests * STAR_RULES.chest;
  const defis = f.wins * STAR_RULES.win + f.badges * STAR_RULES.badge;
  return { total: revision + regularite + missions + defis, revision, regularite, missions, defis };
}

/** A surprise chest: mostly coins, sometimes an item from the shop (when one is left to win). */
export function openChest(random: () => number, candidates: string[]): { coins: number; item: string | null } {
  if (candidates.length && random() < 0.3) return { coins: 0, item: candidates[Math.floor(random() * candidates.length)] };
  return { coins: 15 + 5 * Math.floor(random() * 10), item: null };
}
