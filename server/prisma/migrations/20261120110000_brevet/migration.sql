-- Mode Brevet : mock papers per subject.
CREATE TABLE "BrevetSubject" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "error" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "exercises" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrevetSubject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrevetSubject_learnerId_createdAt_idx" ON "BrevetSubject"("learnerId", "createdAt");
ALTER TABLE "BrevetSubject" ADD CONSTRAINT "BrevetSubject_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
