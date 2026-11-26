import type { Meal, MonthlyBudget, Recipe, Task, Weekday } from "../api/types";
import { formatEuros } from "./money";
import { dayKey } from "./appointments";
import { isCheckable } from "./planningFilter";

export interface TodaySummary {
  taskCount: number;
  /** Next task still to come today (by time), or null. */
  next: Task | null;
  /** Tonight's dinner: recipe title or free text, or null if not planned. */
  dinner: string | null;
  /** Tâches du jour à cocher (hors École et Travail) pas encore faites ; null si on ne sait pas. */
  toTick: number | null;
  /**
   * Budget line. `spentCents`: the whole month. `cappedSpentCents` / `capCents`:
   * only the categories that have a cap (null when none has). `overCount`:
   * how many capped categories are over.
   */
  budget: { spentCents: number; cappedSpentCents: number; capCents: number | null; overCount: number };
}

/** "HH:MM" of now, for comparing with task times. */
export function nowTime(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function todaySummary(
  today: Weekday,
  time: string,
  tasks: Task[],
  meals: Meal[],
  recipes: Recipe[],
  budget: MonthlyBudget | undefined,
  todayDate: string = dayKey(new Date()),
  /** Ids des tâches cochées aujourd'hui, si on les connaît. */
  doneIds?: Set<string>,
): TodaySummary {
  // Un rendez-vous ne compte que le jour de sa date.
  const todays = tasks.filter((t) => (t.appointmentDate ? t.appointmentDate === todayDate : t.weekday === today)).sort((a, b) => a.time.localeCompare(b.time));
  const next = todays.find((t) => t.time >= time) ?? null;
  const meal = meals.find((m) => m.weekday === today && m.type === "dîner");
  const dinner = meal ? (meal.recipeId ? recipes.find((r) => r.id === meal.recipeId)?.title ?? meal.title : meal.title) || null : null;
  // Les plafonds ne comparent que les dépenses des catégories plafonnées
  // (le loyer sans plafond ne « dépasse » rien).
  const caps = budget?.byCategory.filter((c) => c.limitCents !== null) ?? [];
  return {
    taskCount: todays.length,
    next,
    dinner,
    toTick: doneIds ? todays.filter((t) => isCheckable(t) && !doneIds.has(t.id)).length : null,
    budget: {
      spentCents: budget?.totalCents ?? 0,
      cappedSpentCents: caps.reduce((sum, c) => sum + c.totalCents, 0),
      capCents: caps.length > 0 ? caps.reduce((sum, c) => sum + (c.limitCents ?? 0), 0) : null,
      overCount: caps.filter((c) => c.totalCents > (c.limitCents ?? 0)).length,
    },
  };
}

export interface TodayLines {
  tasks: string;
  dinner: string;
  budget: string;
  overBudget: boolean;
}

/** The three sentences shown by the « Aujourd'hui » card and the widget. */
export function todayLines(s: TodaySummary): TodayLines {
  const n = `${s.taskCount} tâche${s.taskCount > 1 ? "s" : ""}`;
  // Le soir : « journée terminée » seulement si tout ce qui se coche est coché.
  const evening = s.toTick ? `Plus rien de prévu · ${s.toTick} à cocher` : `${n} · journée terminée`;
  const tasks = s.taskCount === 0 ? "Rien de prévu aujourd'hui" : s.next ? `${n} · prochaine : ${s.next.time} ${s.next.title}` : evening;
  const dinner = s.dinner ? `Ce soir : ${s.dinner}` : "Dîner pas encore prévu";
  const { capCents, cappedSpentCents, overCount, spentCents } = s.budget;
  const budget =
    capCents === null
      ? `${formatEuros(spentCents)} dépensés ce mois-ci`
      : overCount > 0
        ? overCount === 1
          ? "1 plafond dépassé ce mois-ci"
          : `${overCount} plafonds dépassés ce mois-ci`
        : `Reste ${formatEuros(capCents - cappedSpentCents)} sur les plafonds du mois`;
  return { tasks, dinner, budget, overBudget: overCount > 0 };
}
