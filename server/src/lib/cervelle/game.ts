import { daysBetween } from "./days";

// The game side of Cervelle: coins, xp (the mascot grows), streak of study
// days, daily missions with a chest, and a small shop of accessories.

export const COINS_PER_RIGHT_ANSWER = 2;
export const XP_PER_RIGHT_ANSWER = 10;
export const XP_PER_ANSWER = 2;
export const COINS_PER_SESSION = 5;
export const COINS_SHEETS_READ = 3;
/** Effort bonus: doing better than last time on a course, or going over one's mistakes. Never for a mark alone. */
export const COINS_PROGRESS = 10;
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

// The shop's catalogue moved to ./shop (more slots, seasons, badges).
export { SHOP, shopItem, equip, type Slot } from "./shop";

export interface DaySessions {
  mode: string;
  correct: number;
  total: number;
  seconds?: number;
}

// ─── Minuteur, tâches, habitudes ─────────────────────────────────────────

/** A timer session shorter than this earns nothing and doesn't keep the streak. */
export const FOCUS_MIN_SECONDS = 5 * 60;
/** Timer minutes rewarded per day, so leaving it running all day doesn't pay. */
export const FOCUS_DAILY_CAP_MINUTES = 180;
export const TODO_COINS = 2;
export const TODO_XP = 10;
/** Ticked tasks rewarded per day. */
export const TODO_DAILY_CAP = 8;
export const HABIT_COINS = 1;
export const HABIT_XP = 5;
export const CHALLENGE_COINS = 20;

/** Default timer for a level: shorter for the youngest. */
export function timerDefaults(level: string): { focus: number; pause: number } {
  return level === "primaire" ? { focus: 15, pause: 5 } : { focus: 25, pause: 5 };
}

/**
 * What a timer session earns: 1 coin per 5 minutes and 2 xp per minute,
 * counting only the minutes left under the daily cap.
 */
export function focusReward(seconds: number, minutesAlreadyToday: number) {
  if (seconds < FOCUS_MIN_SECONDS) return { coins: 0, xp: 0, minutes: 0 };
  const minutes = Math.floor(seconds / 60);
  const counted = Math.max(0, Math.min(minutes, FOCUS_DAILY_CAP_MINUTES - minutesAlreadyToday));
  return { coins: Math.floor(counted / 5), xp: counted * 2, minutes };
}

// ─── Missions du jour ────────────────────────────────────────────────────

export interface MissionContext {
  sessions: DaySessions[];
  answersToday: number;
  /** Timer minutes today. */
  focusMinutes: number;
  /** Habits ticked today, and habits planned today that existed before today. */
  habitsChecked: number;
  habitsPlanned: number;
  todosDoneToday: number;
  /** Tasks added today, and open tasks that existed before today. */
  todosAddedToday: number;
  todosOpen: number;
  journalToday: boolean;
  /** The child has a ready revision. */
  hasRevisions: boolean;
  focusTarget: number;
}

interface MissionDef {
  id: string;
  available: (c: MissionContext) => boolean;
  label: (c: MissionContext) => string;
  done: (c: MissionContext) => boolean;
  progress?: (c: MissionContext) => string;
}

const MISSIONS: MissionDef[] = [
  { id: "fiche", available: (c) => c.hasRevisions, label: () => "Lire une fiche de révision", done: (c) => c.sessions.some((s) => s.mode === "fiches") },
  {
    id: "quiz",
    available: (c) => c.hasRevisions,
    label: () => "Réussir un quiz à 60 % ou plus",
    done: (c) => c.sessions.some((s) => s.mode !== "fiches" && s.mode !== "minuteur" && s.total > 0 && s.correct / s.total >= 0.6),
  },
  { id: "questions", available: (c) => c.hasRevisions, label: () => "Répondre à 15 questions", done: (c) => c.answersToday >= 15, progress: (c) => `${Math.min(c.answersToday, 15)}/15` },
  {
    id: "minuteur",
    available: () => true,
    label: (c) => `Travailler ${c.focusTarget} min avec le minuteur`,
    done: (c) => c.focusMinutes >= c.focusTarget,
    progress: (c) => `${Math.min(c.focusMinutes, c.focusTarget)}/${c.focusTarget} min`,
  },
  {
    id: "habitudes",
    available: (c) => c.habitsPlanned >= 2,
    label: () => "Cocher 2 habitudes",
    done: (c) => c.habitsChecked >= 2,
    progress: (c) => `${Math.min(c.habitsChecked, 2)}/2`,
  },
  { id: "tache", available: (c) => c.todosOpen > 0, label: () => "Finir une tâche de ta liste", done: (c) => c.todosDoneToday > 0 },
  { id: "planifier", available: () => true, label: () => "Ajouter un devoir à ta liste", done: (c) => c.todosAddedToday > 0 },
  { id: "journal", available: () => true, label: () => "Écrire dans ton journal", done: (c) => c.journalToday },
];

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>>= 0;
}

/**
 * Today's three missions. They change every day (`seed` = learner + day) and
 * barely during the day: habits and tasks only count if they existed before
 * today, so adding two habits can't swap in an easy mission.
 * A revision mission and the timer come first when they can, so the day
 * always has some real work in it.
 */
export function missions(c: MissionContext, seed: string) {
  const pool = MISSIONS.filter((m) => m.available(c));
  const order = (m: MissionDef) => hash(`${seed}:${m.id}`);
  const revision = pool.filter((m) => ["fiche", "quiz", "questions"].includes(m.id)).sort((a, b) => order(a) - order(b))[0];
  const firsts = [revision, pool.find((m) => m.id === "minuteur")].filter((m): m is MissionDef => !!m);
  const rest = pool.filter((m) => !firsts.includes(m) && !["fiche", "quiz", "questions"].includes(m.id)).sort((a, b) => order(a) - order(b));
  const picked = [...firsts, ...rest].slice(0, 3);
  const list = picked.map((m) => ({ id: m.id, label: m.label(c), done: m.done(c), progress: m.progress ? m.progress(c) : (null as string | null) }));
  return { list, done: list.filter((m) => m.done).length, total: list.length };
}

// ─── Amis ────────────────────────────────────────────────────────────────

export const CHEERS = [
  { id: "bravo", emoji: "👏", label: "Bravo !" },
  { id: "courage", emoji: "💪", label: "Courage !" },
  { id: "on_revise", emoji: "📚", label: "On révise ?" },
  { id: "champion", emoji: "🏆", label: "Champion !" },
  { id: "pense", emoji: "💛", label: "Je pense à toi" },
  { id: "rattrape", emoji: "🚀", label: "Je vais te rattraper !" },
] as const;

export const cheerById = (id: string) => CHEERS.find((c) => c.id === id) ?? null;

/** Easy to read and type: no 0/O or 1/I. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeFriendCode(random: (n: number) => number): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return s;
}

/** Who wins a challenge, from each side's minutes: an id, "tie", or null if nobody worked. */
export function challengeWinner(fromId: string, fromMinutes: number, toId: string, toMinutes: number): string | null {
  if (fromMinutes === 0 && toMinutes === 0) return null;
  if (fromMinutes === toMinutes) return "tie";
  return fromMinutes > toMinutes ? fromId : toId;
}
