-- CreateTable
CREATE TABLE "StarEvent" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "item" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StarEvent_learnerId_key_key" ON "StarEvent"("learnerId", "key");

-- AddForeignKey
ALTER TABLE "StarEvent" ADD CONSTRAINT "StarEvent_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
