-- Cervelle: notifications on the child's phone.
ALTER TABLE "LearnerDevice" ADD COLUMN "pushToken" TEXT;
ALTER TABLE "LearnerDevice" ADD COLUMN "readyAlert" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "LearnerDevice_pushToken_key" ON "LearnerDevice"("pushToken");
