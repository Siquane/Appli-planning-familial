import type { Meal, MonthlyBudget } from "../../api/types";
import { addExpenseTo, dateForWeekday, expenseFromInput, patchTask, removeExpenseFrom, setMealIn, taskFromInput } from "../offlinePatches";
import { offlineBannerText } from "../offlineText";

const NOW = new Date("2026-11-14T12:00:00"); // a Saturday

describe("what the screen shows for changes made offline", () => {
  it("dates a task like the server: the weekday of the current week", () => {
    expect(dateForWeekday(0, NOW).slice(0, 10)).toBe(new Date(2026, 10, 9).toISOString().slice(0, 10));
    const task = taskFromInput("tmp_1", { title: "Courses", category: "Maison", weekday: 2, time: "18:00" }, NOW);
    expect(task).toMatchObject({ id: "tmp_1", duration: 30, priority: "medium", memberIds: [], externalProvider: null });
    expect(patchTask(task, { weekday: 4 }, NOW).date).toBe(dateForWeekday(4, NOW));
    expect(patchTask(task, { title: "Autre" }, NOW).date).toBe(task.date);
  });

  it("replaces the meal of a slot instead of doubling it", () => {
    const lunch: Meal = { id: "m1", week: "2026-11-23", weekday: 1, type: "déjeuner", title: "Pâtes", recipeId: null, notes: "", ingredients: [] };
    const next = setMealIn([lunch], "tmp_2", { weekday: 1, type: "déjeuner", title: "Riz" });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "m1", title: "Riz" });
    expect(setMealIn([lunch], "tmp_2", { weekday: 1, type: "dîner", title: "Soupe" })).toHaveLength(2);
  });

  it("adds and removes an expense in the month's totals", () => {
    const month: MonthlyBudget = { month: "2026-11", totalCents: 5000, byCategory: [{ category: "courses", totalCents: 5000, limitCents: 20000 }], expenses: [] };
    const expense = expenseFromInput("tmp_3", { label: "Pain", amountCents: 250, category: "courses", memberId: null, date: "2026-11-14" }, NOW);
    const added = addExpenseTo(month, expense);
    expect(added.totalCents).toBe(5250);
    expect(added.byCategory[0]).toMatchObject({ totalCents: 5250, limitCents: 20000 });
    expect(added.expenses).toHaveLength(1);
    expect(removeExpenseFrom(added, "tmp_3")).toMatchObject({ totalCents: 5000, expenses: [] });
    // Another month's view is left alone.
    expect(addExpenseTo(month, { ...expense, date: "2026-12-01" })).toBe(month);
  });

  it("says what is going on at the top of the screen", () => {
    expect(offlineBannerText(true, 0)).toBeNull();
    expect(offlineBannerText(true, 2)).toBe("Envoi de 2 changements…");
    expect(offlineBannerText(false, 0)).toContain("reviennent avec le réseau");
    expect(offlineBannerText(false, 1)).toContain("1 changement part");
    expect(offlineBannerText(false, 3)).toContain("3 changements partent");
  });
});
