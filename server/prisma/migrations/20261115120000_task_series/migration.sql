-- AlterTable
ALTER TABLE "Task" ADD COLUMN "seriesId" TEXT;

-- CreateIndex
CREATE INDEX "Task_userId_seriesId_idx" ON "Task"("userId", "seriesId");

-- Regroupe les tâches récurrentes déjà créées sur plusieurs jours : même
-- titre, catégorie, durée, priorité et membres, un seul exemplaire par jour.
WITH keyed AS (
  SELECT t."id", t."userId", t."title", t."category", t."duration", t."priority", t."weekday",
         COALESCE(string_agg(tm."memberId", ',' ORDER BY tm."memberId"), '') AS "members"
  FROM "Task" t
  LEFT JOIN "TaskMember" tm ON tm."taskId" = t."id"
  WHERE t."recurring" = true
  GROUP BY t."id"
),
groups AS (
  SELECT "userId", "title", "category", "duration", "priority", "members", MIN("id") AS "seriesId"
  FROM keyed
  GROUP BY "userId", "title", "category", "duration", "priority", "members"
  HAVING COUNT(*) > 1 AND COUNT(*) = COUNT(DISTINCT "weekday")
)
UPDATE "Task" SET "seriesId" = g."seriesId"
FROM keyed k
JOIN groups g ON g."userId" = k."userId" AND g."title" = k."title" AND g."category" = k."category"
  AND g."duration" = k."duration" AND g."priority" = k."priority" AND g."members" = k."members"
WHERE "Task"."id" = k."id";
