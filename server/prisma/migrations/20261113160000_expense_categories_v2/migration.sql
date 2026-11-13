-- New fixed expense categories: "factures" becomes "énergie", "autre" becomes
-- "divers", and custom categories named like a new fixed one are merged into it.

-- 1. Renamed fixed keys.
UPDATE "Expense" SET "category" = 'énergie' WHERE "category" = 'factures';
UPDATE "Expense" SET "category" = 'divers' WHERE "category" = 'autre';
UPDATE "RecurringExpense" SET "category" = 'énergie' WHERE "category" = 'factures';
UPDATE "RecurringExpense" SET "category" = 'divers' WHERE "category" = 'autre';
UPDATE "CategoryBudget" SET "category" = 'énergie' WHERE "category" = 'factures';
UPDATE "CategoryBudget" SET "category" = 'divers' WHERE "category" = 'autre';

-- 2. Custom categories that now exist as fixed ones.
CREATE TEMP TABLE "_category_merge" AS
SELECT c."id" AS "customId", c."userId", m."key"
FROM "ExpenseCategory" c
JOIN (VALUES
  ('énergie', 'énergie'), ('energie', 'énergie'), ('électricité', 'énergie'), ('énergie & eau', 'énergie'),
  ('assurance', 'assurances'), ('assurances', 'assurances'),
  ('abonnement', 'abonnements'), ('abonnements', 'abonnements'), ('abonnements & télécom', 'abonnements'), ('télécom', 'abonnements'),
  ('restaurant', 'restaurants'), ('restaurants', 'restaurants'), ('restaurants & sorties', 'restaurants'), ('sorties', 'restaurants'),
  ('shopping', 'shopping'), ('vêtements', 'shopping'), ('shopping & vêtements', 'shopping'),
  ('vacances', 'vacances'), ('voyages', 'vacances'), ('vacances & voyages', 'vacances'),
  ('impôts', 'impôts'), ('impots', 'impôts'), ('impôts & taxes', 'impôts'),
  ('épargne', 'épargne'), ('epargne', 'épargne'),
  ('animaux', 'animaux'), ('animal', 'animaux'),
  ('cadeaux', 'cadeaux'), ('cadeau', 'cadeaux'),
  ('divers', 'divers'), ('autre', 'divers')
) AS m("name", "key") ON lower(trim(c."name")) = m."name";

UPDATE "Expense" e SET "category" = m."key" FROM "_category_merge" m WHERE e."userId" = m."userId" AND e."category" = m."customId";
UPDATE "RecurringExpense" r SET "category" = m."key" FROM "_category_merge" m WHERE r."userId" = m."userId" AND r."category" = m."customId";
-- Keep the custom cap only when the fixed category has none yet.
DELETE FROM "CategoryBudget" b USING "_category_merge" m
  WHERE b."userId" = m."userId" AND b."category" = m."customId"
  AND EXISTS (SELECT 1 FROM "CategoryBudget" x WHERE x."userId" = m."userId" AND x."category" = m."key");
UPDATE "CategoryBudget" b SET "category" = m."key" FROM "_category_merge" m WHERE b."userId" = m."userId" AND b."category" = m."customId";
DELETE FROM "ExpenseCategory" c USING "_category_merge" m WHERE c."id" = m."customId";
DROP TABLE "_category_merge";

-- 3. Column defaults.
ALTER TABLE "Expense" ALTER COLUMN "category" SET DEFAULT 'divers';
ALTER TABLE "RecurringExpense" ALTER COLUMN "category" SET DEFAULT 'divers';
