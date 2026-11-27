-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "mentalLevel" INTEGER,
ADD COLUMN     "mentalTables" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "mindMap" JSONB;

-- CreateTable
CREATE TABLE "Dictation" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "words" TEXT[],
    "sentences" JSONB NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dictation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentalRun" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrideShare" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "PrideShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dictation_learnerId_createdAt_idx" ON "Dictation"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "MentalRun_learnerId_level_idx" ON "MentalRun"("learnerId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "PrideShare_token_key" ON "PrideShare"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PrideShare_learnerId_week_key" ON "PrideShare"("learnerId", "week");

-- AddForeignKey
ALTER TABLE "Dictation" ADD CONSTRAINT "Dictation_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalRun" ADD CONSTRAINT "MentalRun_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrideShare" ADD CONSTRAINT "PrideShare_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

