-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_shareToken_key" ON "FamilyMember"("shareToken");
