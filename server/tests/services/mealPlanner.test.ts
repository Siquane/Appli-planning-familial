import { describe, expect, it } from "vitest";
import { anonymizeMembers, buildUserPrompt, sanitizeProposal, type PlannerContext } from "../../src/services/mealPlanner";

const recipes = [{ id: "r1", title: "Lasagnes de Mamie" }];

describe("sanitizeProposal", () => {
  it("keeps one meal per requested slot, drops extras and unknown recipe ids, and sorts the week", () => {
    const out = sanitizeProposal(
      [
        { weekday: 3, type: "dîner", title: "Curry", recipeId: "inventé", notes: "", ingredients: [" 400 g de poulet ", "Lait de coco", "lait de coco", ""] },
        { weekday: 1, type: "dîner", title: "lasagnes", recipeId: "r1", notes: " Doubler les portions ", ingredients: ["pâtes"] },
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
      // A family recipe keeps its own ingredients: Claude's list is dropped.
      { weekday: 1, type: "dîner", title: "Lasagnes de Mamie", recipeId: "r1", notes: "Doubler les portions", ingredients: [] },
      // Trimmed, without blanks or duplicates.
      { weekday: 3, type: "dîner", title: "Curry", recipeId: null, notes: "", ingredients: ["400 g de poulet", "Lait de coco"] },
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
    members: anonymizeMembers(
      [
        { age: 6, favoriteFoods: "pâtes", dislikedFoods: "champignons", appetite: "petit", canteenDays: [0, 1], foodNotes: "", diets: [], allergies: "arachides", foodsToLimit: "" },
        { age: null, favoriteFoods: "", dislikedFoods: "", appetite: null, canteenDays: [], foodNotes: "", diets: [], allergies: "", foodsToLimit: "" },
      ],
      true,
    ),
    keptMeals: [],
    exclude: ["Pizza"],
  };

  it("includes the answers, the family, the recipes and the slots", () => {
    const p = buildUserPrompt(base);
    expect(p).toContain("sans-porc");
    expect(p).toContain("arachides");
    expect(p).toContain("- Enfant 1 (6 ans) — allergies / intolérances (strict) : arachides ; aime : pâtes ; n'aime pas : champignons ; appétit : petit ; déjeune hors de la maison (cantine) le lundi, mardi");
    expect(p).toContain("- Membre 1\n");
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

describe("anonymizeMembers", () => {
  const member = (age: number | null) => ({
    age,
    favoriteFoods: "",
    dislikedFoods: "",
    appetite: null,
    canteenDays: [],
    foodNotes: "",
    diets: ["halal"],
    allergies: "gluten",
    foodsToLimit: "sucre",
  });

  it("labels members by age group, never by name", () => {
    const labels = anonymizeMembers([member(40), member(8), member(38), member(3), member(null)], true).map((m) => m.label);
    expect(labels).toEqual(["Adulte 1", "Enfant 1", "Adulte 2", "Enfant 2", "Membre 1"]);
  });

  it("drops the sensitive fields without consent", () => {
    const [m] = anonymizeMembers([member(40)], false);
    expect(m).toMatchObject({ diets: [], allergies: "", foodsToLimit: "" });
    const [withConsent] = anonymizeMembers([member(40)], true);
    expect(withConsent).toMatchObject({ diets: ["halal"], allergies: "gluten", foodsToLimit: "sucre" });
  });
});

