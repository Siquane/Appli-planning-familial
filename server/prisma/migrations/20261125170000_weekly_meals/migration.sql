-- Chaque semaine a son propre menu : le repas est rangé sous le lundi de sa
-- semaine. Les menus existants deviennent ceux de la semaine en cours (Paris).
ALTER TABLE "Meal" ADD COLUMN "week" TEXT;
UPDATE "Meal" SET "week" = to_char(date_trunc('week', now() AT TIME ZONE 'Europe/Paris'), 'YYYY-MM-DD');
ALTER TABLE "Meal" ALTER COLUMN "week" SET NOT NULL;

DROP INDEX "Meal_userId_weekday_type_key";
CREATE UNIQUE INDEX "Meal_userId_week_weekday_type_key" ON "Meal"("userId", "week", "weekday", "type");
