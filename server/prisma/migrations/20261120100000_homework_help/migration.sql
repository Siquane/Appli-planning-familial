-- « Aide aux devoirs » : photographed exercises with progressive hints.
CREATE TABLE "HomeworkHelp" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkHelp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HomeworkHelp_learnerId_createdAt_idx" ON "HomeworkHelp"("learnerId", "createdAt");
ALTER TABLE "HomeworkHelp" ADD CONSTRAINT "HomeworkHelp_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
