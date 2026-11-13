-- Per-member food preferences for generated menus, and the account-level
-- consent required to store the sensitive ones (diets, allergies, foods to limit).
ALTER TABLE "User" ADD COLUMN "foodHealthConsentAt" TIMESTAMP(3);

ALTER TABLE "FamilyMember"
  ADD COLUMN "favoriteFoods" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "dislikedFoods" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "appetite" TEXT,
  ADD COLUMN "canteenDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "foodNotes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "diets" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "allergies" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "foodsToLimit" TEXT NOT NULL DEFAULT '';
