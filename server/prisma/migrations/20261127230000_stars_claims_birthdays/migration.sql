-- AlterTable
ALTER TABLE "StarCompletion" ADD COLUMN     "bonusKey" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "birthdayRemindDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "StarClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "StarClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "reachedWeek" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthdayContact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "yearKnown" BOOLEAN NOT NULL DEFAULT false,
    "relation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BirthdayContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftIdea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "contactId" TEXT,
    "title" TEXT NOT NULL,
    "bought" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StarClaim_userId_status_idx" ON "StarClaim"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StarClaim_taskId_memberId_week_key" ON "StarClaim"("taskId", "memberId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyGoal_userId_key" ON "FamilyGoal"("userId");

-- CreateIndex
CREATE INDEX "BirthdayContact_userId_idx" ON "BirthdayContact"("userId");

-- CreateIndex
CREATE INDEX "GiftIdea_userId_idx" ON "GiftIdea"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StarCompletion_bonusKey_key" ON "StarCompletion"("bonusKey");

-- AddForeignKey
ALTER TABLE "StarClaim" ADD CONSTRAINT "StarClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarClaim" ADD CONSTRAINT "StarClaim_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarClaim" ADD CONSTRAINT "StarClaim_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyGoal" ADD CONSTRAINT "FamilyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthdayContact" ADD CONSTRAINT "BirthdayContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftIdea" ADD CONSTRAINT "GiftIdea_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "BirthdayContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

