// Smart scheduling engine for "Replanifier ma semaine".
// Ported 1:1 from the Claude Design prototype (design source file —
// scoreCandidate/getProposals), keeping the same weighting so the proposals
// a real user gets match what was designed/approved: priority x deadline x
// day-load x recurring constraints (sleep/lunch/do-not-disturb).
//
// Weekdays here are 0=Lun..6=Dim to match FR display order, not JS's
// Sun-first Date#getDay().

export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const TIME_POOL = ["08:00", "09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];
const MORNING = new Set(["08:00", "09:00", "10:00", "11:00"]);
const MIDDAY = new Set(["12:00", "14:00", "15:00", "16:00"]);
const EVENING = new Set(["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]);

/** Durée prise par défaut quand une tâche n'en a pas. */
const DEFAULT_DURATION = 30;

export type Priority = "high" | "medium" | "low";

export interface Constraints {
  sleepStart: string;
  sleepEnd: string;
  lunchStart: string;
  lunchEnd: string;
  dndStart: string;
  dndEnd: string;
  /** Horaires de travail du compte qui replanifie (aucune proposition pendant ces heures). */
  work?: WorkHours | null;
}

export interface WorkHours {
  /** 0 = lundi … 6 = dimanche ; vide = pas d'horaires. */
  days: number[];
  start: string;
  end: string;
}

export interface SchedulableTask {
  id: string;
  weekday: Weekday;
  time: string;
  priority: Priority;
  deadlineWeekday: Weekday | null;
  memberIds: string[];
  /** Minutes. */
  duration?: number;
}

export interface Candidate {
  weekday: Weekday;
  time: string;
  score: number;
  reasons: string[];
}

function toMin(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Le créneau [from, to[ (minutes) chevauche-t-il la plage start → end (qui peut passer minuit) ? */
function overlaps(from: number, to: number, start: string, end: string): boolean {
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  const ranges = s < e ? [[s, e]] : [[s, 24 * 60], [0, e]];
  return ranges.some(([a, b]) => from < b && to > a);
}

const durationOf = (t: SchedulableTask) => Math.max(1, t.duration || DEFAULT_DURATION);

/** Deux tâches se gênent si elles concernent la même personne, ou si l'une ne concerne personne en particulier. */
function sharePeople(a: SchedulableTask, b: SchedulableTask): boolean {
  if (a.memberIds.length === 0 || b.memberIds.length === 0) return true;
  return a.memberIds.some((m) => b.memberIds.includes(m));
}

export function scoreCandidate(
  weekday: Weekday,
  time: string,
  task: SchedulableTask,
  allTasks: SchedulableTask[],
  constraints: Constraints
): Candidate | null {
  const from = toMin(time);
  const to = from + durationOf(task);
  if (overlaps(from, to, constraints.lunchStart, constraints.lunchEnd)) return null;
  if (overlaps(from, to, constraints.dndStart, constraints.dndEnd)) return null;
  if (overlaps(from, to, constraints.sleepStart, constraints.sleepEnd)) return null;
  const work = constraints.work;
  const workDay = !!work && work.days.includes(weekday);
  if (workDay && overlaps(from, to, work!.start, work!.end)) return null;
  if (task.deadlineWeekday != null && weekday > task.deadlineWeekday) return null;

  // Une tâche déjà prévue bloque toute sa durée, pas seulement son heure de début.
  const conflict = allTasks.some((t) => {
    if (t.id === task.id || t.weekday !== weekday || !sharePeople(t, task)) return false;
    const start = toMin(t.time);
    return from < start + durationOf(t) && to > start;
  });
  if (conflict) return null;

  let score = 0;
  const reasons: string[] = [];
  const priority = task.priority || "medium";
  if (priority === "high" && MORNING.has(time)) {
    score += 3;
    reasons.push("Créneau de concentration le matin — adapté à une tâche prioritaire.");
  } else if (priority === "low" && EVENING.has(time)) {
    score += 3;
    reasons.push("Tâche légère placée en fin de journée.");
  } else if (priority === "medium" && MIDDAY.has(time)) {
    score += 2;
    reasons.push("Énergie moyenne, créneau de milieu de journée.");
  } else {
    score += 0.5;
  }

  if (task.deadlineWeekday != null) {
    const daysUntil = task.deadlineWeekday - weekday;
    score += Math.max(0, 3 - daysUntil);
    if (daysUntil <= 1) reasons.push(`Respecte l'échéance (${WEEKDAYS[task.deadlineWeekday]}).`);
  }
  const loadOnDay = allTasks.filter((t) => t.id !== task.id && t.weekday === weekday).length;
  score += Math.max(0, 2 - loadOnDay);
  if (loadOnDay === 0) reasons.push("Journée encore dégagée.");
  if (workDay) reasons.push("En dehors de tes horaires de travail.");
  reasons.push("Respecte la pause déjeuner et les plages de repos.");
  reasons.push("Aucun conflit avec le planning existant.");
  return { weekday, time, score, reasons };
}

/** Best slots, best first, at most `perDay` per weekday (replan offers several hours a day). */
export function getProposals(task: SchedulableTask, allTasks: SchedulableTask[], constraints: Constraints, limit = 3, perDay = 1): Candidate[] {
  const candidates: Candidate[] = [];
  for (let weekday = 0 as Weekday; weekday <= 6; weekday++) {
    for (const time of TIME_POOL) {
      const c = scoreCandidate(weekday as Weekday, time, task, allTasks, constraints);
      if (c) candidates.push(c);
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const perWeekday = new Map<number, number>();
  const top: Candidate[] = [];
  for (const c of candidates) {
    const n = perWeekday.get(c.weekday) ?? 0;
    if (n >= perDay) continue;
    perWeekday.set(c.weekday, n + 1);
    top.push(c);
    if (top.length === limit) break;
  }
  return top;
}
