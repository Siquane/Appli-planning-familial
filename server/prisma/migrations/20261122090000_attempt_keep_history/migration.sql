-- Answers outlive their question: a revision prepared again keeps the child's history.
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_questionId_fkey";
ALTER TABLE "Attempt" ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
