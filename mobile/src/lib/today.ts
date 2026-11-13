import type { Meal, MonthlyBudget, Recipe, Task, Weekday } from "../api/types";

export interface TodaySummary {
  taskCount: number;
  /** Next task still to come today (by time), or null. */
  next: Task | null;
  /** Tonight's dinner: recipe title or free text, or null if not planned. */
  dinner: string | null;
  /** Budget line: what's left under the caps, or what was spent if no cap. */
  budget: { spentCents: number; capCents: number | null };
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
): TodaySummary {
  const todays = tasks.filter((t) => t.weekday === today).sort((a, b) => a.time.localeCompare(b.time));
  const next = todays.find((t) => t.time >= time) ?? null;
  const meal = meals.find((m) => m.weekday === today && m.type === "dîner");
  const dinner = meal ? (meal.recipeId ? recipes.find((r) => r.id === meal.recipeId)?.title ?? meal.title : meal.title) || null : null;
  const caps = budget?.byCategory.filter((c) => c.limitCents !== null) ?? [];
  return {
    taskCount: todays.length,
    next,
    dinner,
    budget: {
      spentCents: budget?.totalCents ?? 0,
      capCents: caps.length > 0 ? caps.reduce((sum, c) => sum + (c.limitCents ?? 0), 0) : null,
    },
  };
}
