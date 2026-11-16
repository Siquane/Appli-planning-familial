import type { Task, Weekday } from "../api/types";
import { sortWeekdays, type DayTimes } from "./dayTimes";

/**
 * Une « série » = les tâches créées ensemble sur plusieurs jours (une ligne
 * par jour côté serveur), reliées par le même `seriesId`. L'identifiant est
 * fabriqué par l'appli pour que la création marche aussi hors connexion.
 */
export const newSeriesId = () => `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/** La tâche et ses sœurs de série, dans l'ordre de la semaine. Une tâche seule = [tâche]. */
export function seriesOf(tasks: Task[], task: Task): Task[] {
  const siblings = task.seriesId ? tasks.filter((t) => t.seriesId === task.seriesId) : [task];
  if (!siblings.some((t) => t.id === task.id)) siblings.push(task);
  return [...siblings].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
}

/** Ce que le formulaire affiche pour une série : ses jours et l'heure de chacun. */
export function seriesSchedule(siblings: Task[]): { weekdays: Weekday[]; dayTimes: DayTimes; perDay: boolean } {
  const dayTimes: DayTimes = {};
  for (const t of siblings) dayTimes[t.weekday] ??= t.time;
  const weekdays = sortWeekdays(Object.keys(dayTimes).map(Number) as Weekday[]);
  const perDay = new Set(Object.values(dayTimes)).size > 1;
  return { weekdays, dayTimes, perDay };
}

export interface SeriesEditPlan {
  /** Tâches gardées : nouveau jour et, si elle est fixée, nouvelle heure. */
  updates: { id: string; weekday: Weekday; time?: string }[];
  creates: { weekday: Weekday; time: string }[];
  deletes: string[];
}

/**
 * Passe des jours actuels de la série aux jours cochés. Une tâche dont le jour
 * est décoché sert d'abord pour un jour nouvellement coché (elle garde son id,
 * donc son rappel et sa synchro d'agenda) ; sinon elle est supprimée. S'il
 * manque encore des tâches, elles sont créées.
 */
export function planSeriesEdit(siblings: Task[], weekdays: Weekday[], times: DayTimes): SeriesEditPlan {
  const wanted = sortWeekdays([...new Set(weekdays)]);
  const plan: SeriesEditPlan = { updates: [], creates: [], deletes: [] };
  const covered = new Set<Weekday>();
  const freed: Task[] = [];

  for (const t of [...siblings].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))) {
    if (!wanted.includes(t.weekday)) {
      freed.push(t);
    } else if (!covered.has(t.weekday)) {
      covered.add(t.weekday);
      plan.updates.push({ id: t.id, weekday: t.weekday, time: times[t.weekday] ?? t.time });
    } else {
      // Deuxième tâche le même jour (ex. matin et soir) : elle garde son heure.
      plan.updates.push({ id: t.id, weekday: t.weekday });
    }
  }

  for (const w of wanted) {
    if (covered.has(w)) continue;
    const reused = freed.shift();
    const time = times[w] ?? reused?.time ?? "08:00";
    if (reused) plan.updates.push({ id: reused.id, weekday: w, time });
    else plan.creates.push({ weekday: w, time });
  }
  plan.deletes = freed.map((t) => t.id);
  return plan;
}
