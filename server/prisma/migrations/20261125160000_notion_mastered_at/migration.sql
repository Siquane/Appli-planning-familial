-- AlterTable
ALTER TABLE "Notion" ADD COLUMN     "masteredAt" TIMESTAMP(3);


-- Notions already « Maîtrisé »: they count on the treasure map from their last answer.
UPDATE "Notion" SET "masteredAt" = COALESCE("lastAnsweredAt", CURRENT_TIMESTAMP) WHERE "mastery" = 'mastered';
