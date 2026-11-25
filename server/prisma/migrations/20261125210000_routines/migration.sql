-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "stepIds" TEXT[],

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Routine_learnerId_kind_key" ON "Routine"("learnerId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCheck_learnerId_kind_day_key" ON "RoutineCheck"("learnerId", "kind", "day");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

