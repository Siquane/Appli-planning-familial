-- CreateTable
CREATE TABLE "CardDraw" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "cardId" TEXT NOT NULL,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardDraw_learnerId_n_key" ON "CardDraw"("learnerId", "n");

-- AddForeignKey
ALTER TABLE "CardDraw" ADD CONSTRAINT "CardDraw_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

