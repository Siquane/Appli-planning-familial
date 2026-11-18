-- AlterTable
ALTER TABLE "User" ADD COLUMN     "childMemberId" TEXT;

-- CreateTable
CREATE TABLE "ChildLoginCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildLoginCode_codeHash_key" ON "ChildLoginCode"("codeHash");

-- CreateIndex
CREATE INDEX "ChildLoginCode_accountId_idx" ON "ChildLoginCode"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_childMemberId_key" ON "User"("childMemberId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_childMemberId_fkey" FOREIGN KEY ("childMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildLoginCode" ADD CONSTRAINT "ChildLoginCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

