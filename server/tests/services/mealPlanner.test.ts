import { describe, expect, it } from "vitest";
import { buildUserPrompt, sanitizeProposal, type PlannerContext } from "../../src/services/mealPlanner";

const recipes = [{ id: "r1", title: "Lasagnes de Mamie" }];

describe("sanitizeProposal", () => {
  it("keeps one meal per requested slot, drops extras and unknown recipe ids, and sorts the week", () => {
    const out = sanitizeProposal(
      [
        { weekday: 3, type: "dîner", title: "Curry", recipeId: "inventé", notes: "" },
        { weekday: 1, type: "dîner", title: "lasagnes", recipeId: "r1", notes: " Doubler les portions " },
        { weekday: 1, type: "dîner", title: "Doublon", recipeId: null, notes: "" },
        { weekday: 5, type: "dîner", title: "Pas demandé", recipeId: null, notes: "" },
        { weekday: 2, type: "déjeuner", title: "   ", recipeId: null, notes: "" },
      ],
      [
        { weekday: 1, type: "dîner" },
        { weekday: 3, type: "dîner" },
        { weekday: 2, type: "déjeuner" },
      ],
      recipes,
    );
    expect(out).toEqual([
      { weekday: 1, type: "dîner", title: "Lasagnes de Mamie", recipeId: "r1", notes: "Doubler les portions" },
      { weekday: 3, type: "dîner", title: "Curry", recipeId: null, notes: "" },
    ]);
  });
});

describe("buildUserPrompt", () => {
  const base: PlannerContext = {
    slots: [{ weekday: 6, type: "dîner" }],
    preferences: {
      diets: ["sans-porc"],
      allergies: "arachides",
      weekdayTime: "express",
      weekendTime: "élaboré",
      fishPerWeek: 2,
      veggiePerWeek: null,
      useMyRecipes: "souvent",
      wishes: "",
      avoid: "",
    },
    recipes,
    members: [{ name: "Léa", age: 6 }, { name: "Marc", age: null }],
    keptMeals: [],
    exclude: ["Pizza"],
  };

  it("includes the answers, the family, the recipes and the slots", () => {
    const p = buildUserPrompt(base);
    expect(p).toContain("sans-porc");
    expect(p).toContain("arachides");
    expect(p).toContain("Léa (6 ans), Marc");
    expect(p).toContain("[r1] Lasagnes de Mamie");
    expect(p).toContain("Repas avec poisson souhaités sur la semaine : 2");
    expect(p).not.toContain("végétariens souhaités");
    expect(p).toContain("- Pizza");
    expect(p).toContain("weekday 6 (Dimanche) · dîner");
  });

  it("hides the family recipes when the user does not want them", () => {
    const p = buildUserPrompt({ ...base, preferences: { ...base.preferences, useMyRecipes: "jamais" } });
    expect(p).not.toContain("Lasagnes");
  });
});
