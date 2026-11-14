/** What « Générer depuis le menu de la semaine » did, in one toast. */
export function fromMenuMessage(added: number, withoutIngredients: number) {
  const missing =
    withoutIngredients === 0
      ? ""
      : withoutIngredients === 1
        ? "1 plat n'a pas d'ingrédients : régénère-le ou relie-le à une recette."
        : `${withoutIngredients} plats n'ont pas d'ingrédients : régénère-les ou relie-les à une recette.`;
  if (added > 0) {
    const done = `${added} ingrédient${added > 1 ? "s" : ""} ajouté${added > 1 ? "s" : ""} depuis le menu.`;
    return missing ? `${done} ${missing}` : done;
  }
  return missing || "Tout le menu est déjà dans la liste.";
}
