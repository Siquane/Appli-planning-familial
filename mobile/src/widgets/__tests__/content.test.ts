import { buildSnapshot, type WidgetSnapshot } from "../snapshot";
import { formatEuros } from "../../lib/money";
import { menuContent, shoppingContent, summaryContent, tasksContent } from "../content";
import type { Meal, MonthlyBudget, Recipe, ShoppingItem, Task } from "../../api/types";

jest.mock("@react-native-async-storage/async-storage", () => ({}));

// Mercredi 11 novembre 2026, 14:00 → weekday 2
const now = new Date(2026, 10, 11, 14, 0);

const task = (title: string, time: string, weekday: number) => ({ title, time, weekday }) as unknown as Task;
const snap = (over: Partial<WidgetSnapshot> = {}): WidgetSnapshot => ({ savedAt: "", tasks: [], dinners: [], budget: null, shopping: [], ...over });

describe("buildSnapshot", () => {
  it("keeps dinners with recipe titles, unchecked items and the sum of caps", () => {
    const meals = [
      { weekday: 2, type: "dîner", title: "", recipeId: "r1" },
      { weekday: 2, type: "déjeuner", title: "Salade", recipeId: null },
      { weekday: 3, type: "dîner", title: "Pizza", recipeId: null },
    ] as Meal[];
    const recipes = [{ id: "r1", title: "Gratin" }] as Recipe[];
    const budget = { month: "2026-11", totalCents: 5000, byCategory: [{ category: "a", totalCents: 5000, limitCents: 20000 }, { category: "b", totalCents: 0, limitCents: null }], expenses: [] } as unknown as MonthlyBudget;
    const shopping = [{ label: "Lait", checked: false }, { label: "Pain", checked: true }] as ShoppingItem[];
    const s = buildSnapshot([task("Piscine", "17:00", 2)], meals, recipes, budget, shopping, now);
    expect(s.dinners).toEqual([{ weekday: 2, title: "Gratin" }, { weekday: 3, title: "Pizza" }]);
    expect(s.shopping).toEqual(["Lait"]);
    expect(s.budget).toEqual({ month: "2026-11", spentCents: 5000, capCents: 20000 });
  });
});

describe("summaryContent", () => {
  it("shows the next task, tonight's dinner and what's left", () => {
    const c = summaryContent(snap({ tasks: [task("École", "08:30", 2), task("Piscine", "17:00", 2)], dinners: [{ weekday: 2, title: "Gratin" }], budget: { month: "2026-11", spentCents: 5000, capCents: 20000 } }), now);
    expect(c.rows.map((r) => r.text)).toEqual(["17:00 Piscine", "Ce soir : Gratin", `Reste ${formatEuros(15000)} ce mois-ci`]);
  });

  it("ignores last month's budget and flags an overrun", () => {
    expect(summaryContent(snap({ tasks: [task("Piscine", "17:00", 2)], budget: { month: "2026-10", spentCents: 1, capCents: 2 } }), now).rows).toHaveLength(2);
    const over = summaryContent(snap({ budget: { month: "2026-11", spentCents: 300, capCents: 200 } }), now).rows[2];
    expect(over.tone).toBe("danger");
  });
});

describe("tasksContent", () => {
  it("lists today's tasks in order, dims past ones and highlights the next", () => {
    const c = tasksContent(snap({ tasks: [task("Piscine", "17:00", 2), task("École", "08:30", 2), task("Autre jour", "09:00", 3)] }), now);
    expect(c.title).toBe("Mercredi · 2 tâches");
    expect(c.rows).toEqual([{ text: "08:30  École", tone: "faint" }, { text: "17:00  Piscine", tone: "strong" }]);
  });

  it("scrolls to the upcoming tasks on a busy day", () => {
    const tasks = ["07:00", "08:00", "09:00", "10:00", "15:00", "16:00", "18:00"].map((t) => task(t, t, 2));
    expect(tasksContent(snap({ tasks }), now, 3).rows.map((r) => r.text)).toEqual(["15:00  15:00", "16:00  16:00", "18:00  18:00"]);
  });
});

describe("menuContent / shoppingContent", () => {
  it("shows tonight then the next days up to Sunday", () => {
    const c = menuContent(snap({ dinners: [{ weekday: 3, title: "Pizza" }] }), now);
    expect(c.rows.map((r) => r.text)).toEqual(["Ce soir : —", "Jeudi : Pizza", "Vendredi : —", "Samedi : —"]);
  });

  it("counts what's left to buy and folds the overflow", () => {
    const c = shoppingContent(snap({ shopping: ["a", "b", "c", "d"] }), 2);
    expect(c.title).toBe("Courses · 4 à acheter");
    expect(c.rows.map((r) => r.text)).toEqual(["•  a", "•  b", "+ 2 autres"]);
  });
});

describe("empty widgets", () => {
  it("show an example instead of a blank card", () => {
    for (const c of [summaryContent(snap(), now), tasksContent(snap(), now), menuContent(snap(), now), shoppingContent(snap())]) {
      expect(c.rows).toEqual([]);
      expect(c.empty).toBeTruthy();
      expect(c.example?.length).toBeGreaterThan(0);
    }
  });
});
