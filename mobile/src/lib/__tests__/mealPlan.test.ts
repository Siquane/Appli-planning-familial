import type { Meal } from "../../api/types";
import { buildSlots, countFilled } from "../mealPlan";

const meal = (weekday: Meal["weekday"], type: Meal["type"], title = "Plat"): Meal => ({ id: `${weekday}${type}`, week: "2026-11-23", weekday, type, title, recipeId: null, notes: "", ingredients: [] });

describe("buildSlots", () => {
  const meals = [meal(0, "dîner"), meal(1, "déjeuner", "")];

  it("lists days in order and meals in the day's order, skipping planned ones in 'empty' mode", () => {
    expect(buildSlots([1, 0], ["dîner", "déjeuner"], meals, "empty")).toEqual([
      { weekday: 0, type: "déjeuner" },
      { weekday: 1, type: "déjeuner" }, // an empty-titled meal counts as free
      { weekday: 1, type: "dîner" },
    ]);
  });

  it("keeps every slot in 'all' mode", () => {
    expect(buildSlots([0], ["dîner"], meals, "all")).toEqual([{ weekday: 0, type: "dîner" }]);
  });

  it("counts how many chosen slots are already planned", () => {
    expect(countFilled([0, 1], ["déjeuner", "dîner"], meals)).toBe(1);
  });
});
