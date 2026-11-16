import { daysBetween } from "./days";

// The game side of Cervelle: coins, xp (the mascot grows), streak of study
// days, daily missions with a chest, and a small shop of accessories.

export const COINS_PER_RIGHT_ANSWER = 2;
export const XP_PER_RIGHT_ANSWER = 10;
export const XP_PER_ANSWER = 2;
export const COINS_PER_SESSION = 5;
export const COINS_SHEETS_READ = 3;
export const COINS_GREAT_EXAM = 10;
export const CHEST_COINS = 20;

const LEVELS = [
  { xp: 0, name: "Graine d'idée" },
  { xp: 100, name: "Neurone curieux" },
  { xp: 300, name: "Petite cervelle" },
  { xp: 600, name: "Cervelle futée" },
  { xp: 1000, name: "Cervelle maligne" },
  { xp: 1500, name: "Tête bien faite" },
  { xp: 2200, name: "Esprit vif" },
  { xp: 3000, name: "Génie en herbe" },
  { xp: 4000, name: "Grand esprit" },
  { xp: 5500, name: "Cervelle de légende" },
];

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  return {
    level: i + 1,
    name: LEVELS[i].name,
    xp,
    levelXp: LEVELS[i].xp,
    nextLevelXp: next?.xp ?? null,
  };
}

/** New streak after studying on `today`. */
export function nextStreak(lastStudyDay: string | null, streak: number, today: string): number {
  if (!lastStudyDay) return 1;
  const gap = daysBetween(lastStudyDay, today);
  if (gap <= 0) return Math.max(streak, 1);
  if (gap === 1) return streak + 1;
  return 1;
}

/** The streak as it reads today: broken if the child skipped yesterday. */
export function currentStreak(lastStudyDay: string | null, streak: number, today: string): number {
  if (!lastStudyDay) return 0;
  return daysBetween(lastStudyDay, today) <= 1 ? streak : 0;
}

export type Slot = "tete" | "visage" | "cou";

export const SHOP = [
  { id: "casquette", name: "Casquette", slot: "tete", price: 30 },
  { id: "lunettes", name: "Lunettes rondes", slot: "visage", price: 40 },
  { id: "noeud", name: "Nœud papillon", slot: "cou", price: 50 },
  { id: "toque", name: "Toque de chef", slot: "tete", price: 70 },
  { id: "casque", name: "Casque audio", slot: "tete", price: 80 },
  { id: "sorcier", name: "Chapeau de magicien", slot: "tete", price: 100 },
  { id: "echarpe", name: "Écharpe", slot: "cou", price: 60 },
  { id: "masque", name: "Masque de super-héros", slot: "visage", price: 90 },
  { id: "couronne", name: "Couronne", slot: "tete", price: 150 },
] as const satisfies readonly { id: string; name: string; slot: Slot; price: number }[];

export type ShopItemId = (typeof SHOP)[number]["id"];

export function shopItem(id: string) {
  return SHOP.find((i) => i.id === id) ?? null;
}

/** Equipping an item takes its slot's place. */
export function equip(equipped: string[], id: string): string[] {
  const item = shopItem(id);
  if (!item) return equipped;
  return [...equipped.filter((e) => shopItem(e)?.slot !== item.slot), id];
}

export interface DaySessions {
  mode: string;
  correct: number;
  total: number;
}

/** Today's three missions, computed from what the child did today. */
export function missions(sessions: DaySessions[], answersToday: number) {
  const quizDone = sessions.some((s) => s.mode !== "fiches" && s.total > 0 && s.correct / s.total >= 0.6);
  const list = [
    { id: "fiche", label: "Lire une fiche de révision", done: sessions.some((s) => s.mode === "fiches"), progress: null as string | null },
    { id: "quiz", label: "Réussir un quiz à 60 % ou plus", done: quizDone, progress: null as string | null },
    { id: "questions", label: "Répondre à 15 questions", done: answersToday >= 15, progress: `${Math.min(answersToday, 15)}/15` },
  ];
  return { list, done: list.filter((m) => m.done).length, total: list.length };
}
