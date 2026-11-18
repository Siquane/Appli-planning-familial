// Cervelle's badges. Pure: the route gathers the numbers (BadgeStats) and the
// days the child revised, this file says which badges they earn and what is
// left to do. A badge earned is stored once (LearnerBadge, key below) and pays
// its coins once.
//
// Keys: « photographe:2 » (success, tier 2), « saison:automne:2026 »,
// « fete:noel:2026 ».

import { addDays, daysBetween } from "./days";

export interface BadgeStats {
  /** Ready revisions (courses photographed and turned into sheets). */
  revisions: number;
  /** Distinct subjects among those revisions. */
  subjects: number;
  /** QCM sessions answered without a mistake. */
  perfectQuizzes: number;
  /** Notions (leaves) marked « Maîtrisé ». */
  mastered: number;
  /** Best interro, out of 20 (0 when none). */
  bestInterro20: number;
  bestStreak: number;
  /** Timer sessions of 5 minutes or more. */
  focusSessions: number;
  /** Revisions whose interro was practised before the exam day. */
  preparedExams: number;
  /** Answers given, all modes. */
  answers: number;
  /** Total revision time, in minutes. */
  minutes: number;
}

export type Shape = "star" | "shield" | "hexagon" | "round" | "flower" | "diamond";

interface SuccessDef {
  id: string;
  label: string;
  /** Ionicons name for the emblem. */
  icon: string;
  shape: Shape;
  stat: keyof BadgeStats;
  tiers: [number, number, number];
  /** « Encore {n} … » — what one more unit is. */
  unit: (n: number) => string;
  describe: (target: number) => string;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export const SUCCESSES: SuccessDef[] = [
  { id: "photographe", label: "Photographe", icon: "camera", shape: "round", stat: "revisions", tiers: [1, 10, 50], unit: (n) => plural(n, "cours en photo", "cours en photo"), describe: (t) => `Prendre ${t} ${plural(t, "cours", "cours")} en photo.` },
  { id: "sans_faute", label: "Sans-faute", icon: "checkmark-done", shape: "shield", stat: "perfectQuizzes", tiers: [1, 5, 20], unit: (n) => plural(n, "QCM parfait", "QCM parfaits"), describe: (t) => `Faire ${t} ${plural(t, "QCM", "QCM")} sans aucune faute.` },
  { id: "memoire", label: "Mémoire d'éléphant", icon: "bulb", shape: "flower", stat: "mastered", tiers: [10, 50, 200], unit: (n) => plural(n, "notion maîtrisée", "notions maîtrisées"), describe: (t) => `Avoir ${t} notions « Maîtrisé ».` },
  { id: "as_interro", label: "As de l'interro", icon: "ribbon", shape: "star", stat: "bestInterro20", tiers: [15, 18, 20], unit: (n) => plural(n, "point", "points"), describe: (t) => `Avoir ${t}/20 ou plus à une interro de Cervelle.` },
  { id: "regulier", label: "Régulier", icon: "flame", shape: "diamond", stat: "bestStreak", tiers: [3, 7, 30], unit: (n) => plural(n, "jour de série", "jours de série"), describe: (t) => `Réviser ${t} jours de suite.` },
  { id: "concentre", label: "Concentré", icon: "timer", shape: "hexagon", stat: "focusSessions", tiers: [5, 25, 100], unit: (n) => plural(n, "séance de minuteur", "séances de minuteur"), describe: (t) => `Finir ${t} séances de minuteur (5 minutes ou plus).` },
  { id: "explorateur", label: "Explorateur", icon: "compass", shape: "round", stat: "subjects", tiers: [3, 5, 8], unit: (n) => plural(n, "matière", "matières"), describe: (t) => `Réviser ${t} matières différentes.` },
  { id: "prevoyant", label: "Prévoyant", icon: "calendar", shape: "shield", stat: "preparedExams", tiers: [1, 5, 15], unit: (n) => plural(n, "interro préparée", "interros préparées"), describe: (t) => `Faire l'interro de Cervelle avant le vrai contrôle, ${t} fois.` },
];

/** Coins paid by tier (bronze, silver, gold), and for a season or a holiday. */
export const TIER_COINS = [10, 25, 50] as const;
export const SEASON_COINS = 25;
export const FETE_COINS = 15;
/** Days of revision a season asks for. */
export const SEASON_DAYS = 10;

export const RECORDS = [
  { id: "serie", label: "Plus longue série", icon: "flame", stat: "bestStreak" as const, unit: (n: number) => plural(n, "jour", "jours") },
  { id: "interro", label: "Meilleure interro", icon: "ribbon", stat: "bestInterro20" as const, unit: () => "/20" },
  { id: "temps", label: "Temps de révision", icon: "time", stat: "minutes" as const, unit: () => "" },
  { id: "questions", label: "Questions répondues", icon: "help-circle", stat: "answers" as const, unit: (n: number) => plural(n, "question", "questions") },
];

/** 0 (none) to 3 (gold). */
export function tierOf(value: number, tiers: readonly number[]): number {
  return tiers.filter((t) => value >= t).length;
}

// ── Seasons and holidays ──

type SeasonId = "printemps" | "ete" | "automne" | "hiver";
const SEASONS: { id: SeasonId; label: string; icon: string; shape: Shape; start: string }[] = [
  // Start dates (MM-DD), astronomical, rounded the French way.
  { id: "printemps", label: "Printemps", icon: "flower", shape: "flower", start: "03-20" },
  { id: "ete", label: "Été", icon: "sunny", shape: "star", start: "06-21" },
  { id: "automne", label: "Automne", icon: "leaf", shape: "hexagon", start: "09-22" },
  { id: "hiver", label: "Hiver", icon: "snow", shape: "diamond", start: "12-21" },
];

export interface Window {
  key: string;
  family: "saison" | "fete";
  id: string;
  label: string;
  icon: string;
  shape: Shape;
  /** First and last day, « YYYY-MM-DD », both included. */
  from: string;
  to: string;
  /** Distinct revision days needed inside the window. */
  needs: number;
  coins: number;
  hint: string;
}

/** The season containing `day`; winter is named after the year it starts in. */
export function seasonWindow(day: string): Window {
  const year = Number(day.slice(0, 4));
  const md = day.slice(5);
  let idx = -1;
  SEASONS.forEach((s, i) => {
    if (md >= s.start) idx = i;
  });
  let startYear = year;
  if (idx === -1) {
    idx = 3; // before 20 March: last year's winter
    startYear = year - 1;
  }
  const s = SEASONS[idx];
  const from = `${startYear}-${s.start}`;
  const nextIdx = (idx + 1) % 4;
  const nextYear = nextIdx === 0 ? startYear + 1 : startYear;
  const to = addDays(`${nextYear}-${SEASONS[nextIdx].start}`, -1);
  return {
    key: `saison:${s.id}:${startYear}`,
    family: "saison",
    id: s.id,
    label: `${s.label} ${startYear}`,
    icon: s.icon,
    shape: s.shape,
    from,
    to,
    needs: SEASON_DAYS,
    coins: SEASON_COINS,
    hint: `Réviser ${SEASON_DAYS} jours pendant la saison.`,
  };
}

/** Easter Sunday (Gregorian), « YYYY-MM-DD ». */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const dayOfMonth = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
}

/** The holidays of a calendar year, in date order. */
export function fetesOf(year: number): Window[] {
  const fete = (id: string, label: string, icon: string, shape: Shape, from: string, to: string, hint: string): Window => ({
    key: `fete:${id}:${year}`,
    family: "fete",
    id,
    label: `${label} ${year}`,
    icon,
    shape,
    from,
    to,
    needs: 1,
    coins: FETE_COINS,
    hint,
  });
  const e = easter(year);
  return [
    fete("chandeleur", "Chandeleur", "restaurant", "round", `${year}-02-02`, `${year}-02-02`, "Réviser le 2 février, jour des crêpes."),
    fete("poisson", "Poisson d'avril", "fish", "diamond", `${year}-04-01`, `${year}-04-01`, "Réviser le 1er avril. Ce n'est pas une blague !"),
    fete("paques", "Pâques", "egg", "flower", addDays(e, -2), addDays(e, 1), "Réviser pendant le week-end de Pâques."),
    fete("musique", "Fête de la musique", "musical-notes", "star", `${year}-06-21`, `${year}-06-21`, "Réviser le 21 juin."),
    fete("rentree", "Rentrée", "school", "shield", `${year}-09-01`, `${year}-09-07`, "Réviser pendant la première semaine de septembre."),
    fete("halloween", "Halloween", "moon", "hexagon", `${year}-10-28`, `${year}-11-03`, "Réviser autour d'Halloween (28 octobre – 3 novembre)."),
    fete("noel", "Noël", "gift", "star", `${year}-12-20`, `${year + 1}-01-03`, "Réviser pendant les vacances de Noël (20 décembre – 3 janvier)."),
  ];
}

const inWindow = (w: Window, day: string) => day >= w.from && day <= w.to;

/** Windows that matter today: past ones of this and last year, the current ones, the next holiday. */
export function windowsAround(today: string): Window[] {
  const year = Number(today.slice(0, 4));
  const fetes = [...fetesOf(year - 1), ...fetesOf(year), ...fetesOf(year + 1)];
  const seasons: Window[] = [];
  for (let d = `${year - 1}-01-01`; d <= today; ) {
    const s = seasonWindow(d);
    if (!seasons.some((x) => x.key === s.key)) seasons.push(s);
    d = addDays(s.to, 1);
  }
  return [...seasons, ...fetes.filter((f) => f.from <= addDays(today, 60) && daysBetween(f.to, today) <= 400)];
}

// ── Putting it together ──

export interface SuccessView {
  id: string;
  label: string;
  icon: string;
  shape: Shape;
  tier: number;
  tiers: number[];
  value: number;
  /** What the next tier asks, or null when gold. */
  next: { target: number; left: string; describe: string } | null;
  describe: string;
  coins: number[];
}

export interface WindowView {
  key: string;
  family: "saison" | "fete";
  label: string;
  icon: string;
  shape: Shape;
  earned: boolean;
  /** « now » (can still be earned), « soon » (not started), « past » (missed or earned). */
  when: "now" | "soon" | "past";
  days: number;
  needs: number;
  from: string;
  to: string;
  hint: string;
  coins: number;
}

export interface BadgeView {
  records: { id: string; label: string; icon: string; value: number; unit: string }[];
  successes: SuccessView[];
  windows: WindowView[];
  /** Every key earned with these numbers. */
  earnedKeys: string[];
}

export function computeBadges(stats: BadgeStats, studyDays: string[], today: string): BadgeView {
  const earnedKeys: string[] = [];
  const successes = SUCCESSES.map((s) => {
    const value = stats[s.stat];
    const tier = tierOf(value, s.tiers);
    for (let t = 1; t <= tier; t++) earnedKeys.push(`${s.id}:${t}`);
    const target = tier < 3 ? s.tiers[tier] : null;
    return {
      id: s.id,
      label: s.label,
      icon: s.icon,
      shape: s.shape,
      tier,
      tiers: [...s.tiers],
      value,
      next: target === null ? null : { target, left: `Encore ${target - value} ${s.unit(target - value)}`, describe: s.describe(target) },
      describe: s.describe(s.tiers[Math.max(0, tier - 1)]),
      coins: [...TIER_COINS],
    };
  });

  const days = [...new Set(studyDays)].sort();
  const windows = windowsAround(today)
    .map((w) => {
      const count = days.filter((d) => inWindow(w, d)).length;
      const earned = count >= w.needs;
      if (earned) earnedKeys.push(w.key);
      const when: WindowView["when"] = today < w.from ? "soon" : today > w.to ? "past" : "now";
      return { key: w.key, family: w.family, label: w.label, icon: w.icon, shape: w.shape, earned, when, days: Math.min(count, w.needs), needs: w.needs, from: w.from, to: w.to, hint: w.hint, coins: w.coins };
    })
    // Show what was earned, what is happening now, and the next holiday; hide the ones missed.
    .filter((w) => w.earned || w.when !== "past")
    .sort((a, b) => (a.from < b.from ? 1 : -1));
  const firstSoon = windows.filter((w) => w.when === "soon").at(-1);
  const shown = windows.filter((w) => w.when !== "soon" || w === firstSoon);

  return {
    records: RECORDS.map((r) => {
      const value = stats[r.stat];
      return { id: r.id, label: r.label, icon: r.icon, value, unit: r.unit(value) };
    }),
    successes,
    windows: shown,
    earnedKeys,
  };
}

/** Coins a newly earned key pays. */
export function coinsFor(key: string): number {
  if (key.startsWith("saison:")) return SEASON_COINS;
  if (key.startsWith("fete:")) return FETE_COINS;
  const tier = Number(key.split(":")[1]);
  return TIER_COINS[tier - 1] ?? 0;
}

const TIER_NAMES = ["", "bronze", "argent", "or"];
const SEASON_NAMES: Record<string, string> = { printemps: "Printemps", ete: "Été", automne: "Automne", hiver: "Hiver" };

/** A stored badge key in words: « Photographe (argent) », « Automne 2026 », « Noël 2026 ». */
export function BADGE_LABELS(key: string): string {
  const [a, b, c] = key.split(":");
  if (a === "saison") return `${SEASON_NAMES[b] ?? b} ${c}`;
  if (a === "fete") return fetesOf(Number(c)).find((f) => f.id === b)?.label ?? key;
  const s = SUCCESSES.find((x) => x.id === a);
  return s ? `${s.label} (${TIER_NAMES[Number(b)] ?? b})` : key;
}
