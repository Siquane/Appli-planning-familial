-- AlterTable
ALTER TABLE "SplitExpense" ADD COLUMN     "addedById" TEXT;

-- AlterTable
ALTER TABLE "SplitParticipant" ADD COLUMN     "linkToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SplitParticipant_linkToken_key" ON "SplitParticipant"("linkToken");

