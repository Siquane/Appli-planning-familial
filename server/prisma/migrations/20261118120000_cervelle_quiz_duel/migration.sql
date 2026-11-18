-- CreateTable
CREATE TABLE "QuizDuel" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "revisionTitle" TEXT NOT NULL,
    "questionIds" TEXT[],
    "fromScore" INTEGER,
    "toScore" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "winnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "QuizDuel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuizDuel_fromId_createdAt_idx" ON "QuizDuel"("fromId", "createdAt");

-- CreateIndex
CREATE INDEX "QuizDuel_toId_createdAt_idx" ON "QuizDuel"("toId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuizDuel" ADD CONSTRAINT "QuizDuel_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizDuel" ADD CONSTRAINT "QuizDuel_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
