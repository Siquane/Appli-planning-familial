import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Meal, Member, MonthlyBudget, Recipe, ShoppingItem, Task, Weekday } from "../api/types";

// What the home-screen widgets show. The app saves it on the phone each time
// its data changes; the widgets read it, even when the app is closed. Times
// ("next task", "tonight") are worked out when the widget draws, not here.

export const WIDGET_NAMES = ["Resume", "Taches", "Menu", "Courses"] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

export interface WidgetSnapshot {
  savedAt: string;
  /** `who`: first names of the assigned members (« Léa, Tom », « Léa +2 »); absent in older snapshots. */
  tasks: { title: string; time: string; weekday: Weekday; who?: string }[];
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
  members: Member[] = [],
  now: Date = new Date(),
): WidgetSnapshot {
  const caps = budget?.byCategory.filter((c) => c.limitCents !== null) ?? [];
  return {
    savedAt: now.toISOString(),
    tasks: tasks.map((t) => ({ title: t.title, time: t.time, weekday: t.weekday, who: whoLabel(t.memberIds ?? [], members) })),
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

/** First names of a task's members, in family order: « Léa », « Léa, Tom », « Léa +2 ». */
export function whoLabel(memberIds: string[], members: Member[]): string {
  const names = members.filter((m) => memberIds.includes(m.id)).map((m) => m.name.trim().split(/\s+/)[0]).filter(Boolean);
  if (names.length <= 2) return names.join(", ");
  return `${names[0]} +${names.length - 1}`;
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
