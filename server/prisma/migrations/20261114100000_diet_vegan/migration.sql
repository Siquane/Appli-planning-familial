-- "pescetarien" is no longer offered (replaced by "vegan"): members who had it
-- keep the closest remaining diet, "végétarien", without duplicates.
UPDATE "FamilyMember"
SET "diets" = ARRAY(SELECT DISTINCT unnest(array_replace("diets", 'pescetarien', 'végétarien')))
WHERE 'pescetarien' = ANY("diets");
