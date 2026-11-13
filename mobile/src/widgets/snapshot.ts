import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Meal, MonthlyBudget, Recipe, ShoppingItem, Task, Weekday } from "../api/types";

// What the home-screen widgets show. The app saves it on the phone each time
// its data changes; the widgets read it, even when the app is closed. Times
// ("next task", "tonight") are worked out when the widget draws, not here.

export const WIDGET_NAMES = ["Resume", "Taches", "Menu", "Courses"] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export interface WidgetSnapshot {
  savedAt: string;
  tasks: { title: string; time: string; weekday: Weekday }[];
  /** Dinners of the week, recipe titles already resolved. */
  dinners: { weekday: Weekday; title: string }[];
  budget: { month: string; spentCents: number; capCents: number | null } | null;
  /** Items still to buy. */
  shopping: string[];
}

const KEY = "widget:snapshot:v1";

export function buildSnapshot(
  tasks: Task[],
  meals: Meal[],
  recipes: Recipe[],
  budget: MonthlyBudget | undefined,
  shopping: ShoppingItem[],
  now: Date = new Date(),
): WidgetSnapshot {
  const caps = budget?.byCategory.filter((c) => c.limitCents !== null) ?? [];
  return {
    savedAt: now.toISOString(),
    tasks: tasks.map((t) => ({ title: t.title, time: t.time, weekday: t.weekday })),
    dinners: meals
      .filter((m) => m.type === "dîner")
      .map((m) => ({ weekday: m.weekday, title: (m.recipeId ? recipes.find((r) => r.id === m.recipeId)?.title : null) ?? m.title }))
      .filter((d) => d.title),
    budget: budget
      ? { month: budget.month, spentCents: budget.totalCents, capCents: caps.length > 0 ? caps.reduce((sum, c) => sum + (c.limitCents ?? 0), 0) : null }
      : null,
    shopping: shopping.filter((i) => !i.checked).map((i) => i.label),
  };
}

export async function saveSnapshot(snapshot: WidgetSnapshot | null): Promise<void> {
  if (snapshot) await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  else await AsyncStorage.removeItem(KEY);
}

export async function loadSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
  } catch {
    return null;
  }
}
