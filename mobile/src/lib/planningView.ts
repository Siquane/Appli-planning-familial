import type { Task } from "../api/types";
import { color } from "../theme/tokens";
import { isCheckable } from "./planningFilter";

// Calculs de l'écran Planning : couleur de chaque membre, avancement de
// chacun, heure actuelle dans la journée et encouragements.

const PILLARS = ["pillar1", "pillar2", "pillar3", "pillar4"] as const;

/** Couleur d'un membre : les 4 anneaux du logo, dans l'ordre de la famille. */
export function memberColor(index: number): string {
  return color[PILLARS[((index % 4) + 4) % 4]];
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Heure de fin « HH:MM » (s'arrête à 23:59). */
export function endTime(time: string, duration: number): string {
  const end = Math.min(toMinutes(time) + Math.max(0, duration), 23 * 60 + 59);
  return `${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/** « dans 48 min », « dans 1 h 05 », « maintenant ». */
export function untilLabel(time: string, now: string): string {
  const diff = toMinutes(time) - toMinutes(now);
  if (diff <= 0) return "maintenant";
  if (diff < 60) return `dans ${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m ? `dans ${h} h ${pad(m)}` : `dans ${h} h`;
}

/** Prochaine tâche à cocher, pas encore faite, à partir de maintenant. */
export function nextTask<T extends Pick<Task, "id" | "time" | "category">>(tasks: T[], doneIds: Set<string>, now: string): T | null {
  return tasks.find((t) => isCheckable(t) && !doneIds.has(t.id) && t.time >= now) ?? null;
}

/** Où tracer le trait « maintenant » : avant la première tâche qui commence après. */
export function nowLineIndex(tasks: Pick<Task, "time">[], now: string): number {
  const i = tasks.findIndex((t) => t.time > now);
  return i === -1 ? tasks.length : i;
}

/** Tâches à cocher d'un membre ce jour-là, et combien sont faites. */
export function memberProgress(tasks: Pick<Task, "id" | "category" | "memberIds">[], memberId: string, doneIds: Set<string>): { done: number; total: number } {
  const mine = tasks.filter((t) => isCheckable(t) && t.memberIds.includes(memberId));
  return { done: mine.filter((t) => doneIds.has(t.id)).length, total: mine.length };
}

/** Étoiles encore à gagner : tâches à cocher pas encore faites. */
export function starsToWin(tasks: Pick<Task, "id" | "category" | "stars">[], doneIds: Set<string>): number {
  return tasks.filter((t) => isCheckable(t) && !doneIds.has(t.id)).reduce((sum, t) => sum + (t.stars || 0), 0);
}

/** Mot d'encouragement dans le planning d'une personne. */
export function cheerLine(name: string, done: number, total: number): string {
  const left = total - done;
  if (total === 0) return `Journée libre pour ${name}`;
  if (left === 0) return `Tout est fait, bravo ${name} !`;
  if (done === 0) return `Allez ${name}, ${total} tâche${total > 1 ? "s" : ""} au programme`;
  return `Bravo ${name}, plus que ${left} tâche${left > 1 ? "s" : ""} !`;
}
