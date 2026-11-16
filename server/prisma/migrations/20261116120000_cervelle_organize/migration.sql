-- Cervelle : agenda, tâches, habitudes, journal, minuteur, profil d'élève et amis.
-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "breakMinutes" INTEGER,
ADD COLUMN     "focusMinutes" INTEGER,
ADD COLUMN     "friendCode" TEXT,
ADD COLUMN     "studyProfile" JSONB;

-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "label" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StudyEvent" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'cours',
    "weekday" INTEGER,
    "day" TEXT,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT 'enfant',
    "source" TEXT NOT NULL DEFAULT 'cervelle',
    "passerelleTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TodoItem" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "important" BOOLEAN NOT NULL DEFAULT true,
    "dueDay" TEXT,
    "doneAt" TIMESTAMP(3),
    "coins" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT 'enfant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '⭐',
    "color" TEXT NOT NULL DEFAULT 'ciel',
    "days" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT 'enfant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCheck" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mood" INTEGER NOT NULL,
    "learned" TEXT NOT NULL DEFAULT '',
    "proud" TEXT NOT NULL DEFAULT '',
    "hard" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "fromApproved" BOOLEAN NOT NULL DEFAULT false,
    "toApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheer" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cheer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winnerId" TEXT,
    "fromMinutes" INTEGER,
    "toMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyEvent_learnerId_idx" ON "StudyEvent"("learnerId");

-- CreateIndex
CREATE INDEX "TodoItem_learnerId_createdAt_idx" ON "TodoItem"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Habit_learnerId_idx" ON "Habit"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCheck_habitId_day_key" ON "HabitCheck"("habitId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_learnerId_day_key" ON "JournalEntry"("learnerId", "day");

-- CreateIndex
CREATE INDEX "Friendship_toId_idx" ON "Friendship"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_fromId_toId_key" ON "Friendship"("fromId", "toId");

-- CreateIndex
CREATE INDEX "Cheer_toId_createdAt_idx" ON "Cheer"("toId", "createdAt");

-- CreateIndex
CREATE INDEX "Cheer_fromId_createdAt_idx" ON "Cheer"("fromId", "createdAt");

-- CreateIndex
CREATE INDEX "Challenge_fromId_week_idx" ON "Challenge"("fromId", "week");

-- CreateIndex
CREATE INDEX "Challenge_toId_week_idx" ON "Challenge"("toId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "Learner_friendCode_key" ON "Learner"("friendCode");

-- AddForeignKey
ALTER TABLE "StudyEvent" ADD CONSTRAINT "StudyEvent_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoItem" ADD CONSTRAINT "TodoItem_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCheck" ADD CONSTRAINT "HabitCheck_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cheer" ADD CONSTRAINT "Cheer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
