import { fromMenuMessage } from "../shopping";

describe("fromMenuMessage", () => {
  it("counts what was added", () => {
    expect(fromMenuMessage(1, 0)).toBe("1 ingrédient ajouté depuis le menu.");
    expect(fromMenuMessage(5, 0)).toBe("5 ingrédients ajoutés depuis le menu.");
  });

  it("says when the whole menu is already on the list", () => {
    expect(fromMenuMessage(0, 0)).toBe("Tout le menu est déjà dans la liste.");
  });

  it("explains dishes without ingredients instead of claiming the list is complete", () => {
    expect(fromMenuMessage(0, 3)).toBe("3 plats n'ont pas d'ingrédients : régénère-les ou relie-les à une recette.");
    expect(fromMenuMessage(4, 1)).toBe("4 ingrédients ajoutés depuis le menu. 1 plat n'a pas d'ingrédients : régénère-le ou relie-le à une recette.");
  });
});
