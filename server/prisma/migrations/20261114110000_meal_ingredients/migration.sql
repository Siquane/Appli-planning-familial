-- Ingredients of a generated dish (family recipes keep their own), used by
-- « Générer depuis le menu de la semaine » on the shopping list.
ALTER TABLE "Meal" ADD COLUMN "ingredients" TEXT[] DEFAULT ARRAY[]::TEXT[];
