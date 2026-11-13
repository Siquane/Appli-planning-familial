import { foodSummary, toggle } from "../memberFood";

const empty = { favoriteFoods: "", dislikedFoods: "", appetite: null, canteenDays: [], foodNotes: "", diets: [], allergies: "", foodsToLimit: "" };

describe("foodSummary", () => {
  it("says when nothing is filled in", () => {
    expect(foodSummary(empty)).toBe("Rien de renseigné");
  });

  it("counts items separated by commas, semicolons or lines", () => {
    expect(
      foodSummary({ ...empty, favoriteFoods: "pâtes, pizza; crêpes", dislikedFoods: "champignons", allergies: "arachides", diets: ["halal"], canteenDays: [0, 1], appetite: "gros" }),
    ).toBe("3 plats préférés · 1 n'aime pas · 1 régime · 1 allergie · cantine 2 j · gros appétit");
  });
});

describe("toggle", () => {
  it("adds or removes a value", () => {
    expect(toggle([0, 2], 1)).toEqual([0, 2, 1]);
    expect(toggle([0, 2], 2)).toEqual([0]);
  });
});
