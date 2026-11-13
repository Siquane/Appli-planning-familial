import type { Expense, FamilyDocument, Recipe, ShoppingItem, Task } from "../api/types";

/** Lowercase, accents removed: « Crème » matches « creme ». */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export interface SearchSources {
  tasks: Task[];
  recipes: Recipe[];
  documents: FamilyDocument[];
  expenses: Expense[];
  shopping: ShoppingItem[];
}

export interface SearchResults {
  tasks: Task[];
  recipes: Recipe[];
  documents: FamilyDocument[];
  expenses: Expense[];
  shopping: ShoppingItem[];
  total: number;
}

const matches = (q: string, ...fields: (string | undefined)[]) => fields.some((f) => f && normalize(f).includes(q));

/**
 * Everything matching the query across the app. Recipes also match on their
 * ingredients (« courgette » finds the gratin), tasks on their notes.
 * An empty query returns nothing.
 */
export function searchAll(query: string, s: SearchSources): SearchResults {
  const q = normalize(query);
  if (!q) return { tasks: [], recipes: [], documents: [], expenses: [], shopping: [], total: 0 };
  const tasks = s.tasks.filter((t) => matches(q, t.title, t.notes, t.category)).sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
  const recipes = s.recipes.filter((r) => matches(q, r.title, r.notes, ...r.ingredients));
  const documents = s.documents.filter((d) => matches(q, d.title, d.fileName));
  const expenses = s.expenses.filter((e) => matches(q, e.label));
  const shopping = s.shopping.filter((i) => matches(q, i.label));
  return { tasks, recipes, documents, expenses, shopping, total: tasks.length + recipes.length + documents.length + expenses.length + shopping.length };
}
