-- CreateTable
CREATE TABLE "TeachQuiz" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "questionIds" TEXT[],
    "answers" JSONB,
    "answeredById" TEXT,
    "answeredByName" TEXT,
    "answeredAt" TIMESTAMP(3),
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeachQuiz_learnerId_createdAt_idx" ON "TeachQuiz"("learnerId", "createdAt");

-- AddForeignKey
ALTER TABLE "TeachQuiz" ADD CONSTRAINT "TeachQuiz_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachQuiz" ADD CONSTRAINT "TeachQuiz_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

