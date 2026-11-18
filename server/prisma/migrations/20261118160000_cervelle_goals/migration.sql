-- CreateTable
CREATE TABLE "LearnerGoal" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "reward" TEXT NOT NULL,
    "wins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearnerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerGoal_learnerId_idx" ON "LearnerGoal"("learnerId");

-- AddForeignKey
ALTER TABLE "LearnerGoal" ADD CONSTRAINT "LearnerGoal_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
