-- Premium becomes two packs (Budget, Menus); "Les 2" sets both.
ALTER TABLE "User" ADD COLUMN "budgetUntil" TIMESTAMP(3),
ADD COLUMN "mealsUntil" TIMESTAMP(3);

-- Whoever was Premium keeps everything.
UPDATE "User" SET "budgetUntil" = "premiumUntil", "mealsUntil" = "premiumUntil" WHERE "premiumUntil" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "premiumUntil";
