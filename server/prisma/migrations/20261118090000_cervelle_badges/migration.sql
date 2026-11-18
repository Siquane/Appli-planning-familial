-- CreateTable
CREATE TABLE "LearnerBadge" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "LearnerBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearnerBadge_learnerId_key_key" ON "LearnerBadge"("learnerId", "key");

-- AddForeignKey
ALTER TABLE "LearnerBadge" ADD CONSTRAINT "LearnerBadge_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
