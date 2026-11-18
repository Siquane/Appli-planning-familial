-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "appointmentDate" TEXT,
ADD COLUMN     "location" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "remind" TEXT;
