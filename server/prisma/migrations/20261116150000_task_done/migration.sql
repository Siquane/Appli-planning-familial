-- Tâches cochées « faites », jour par jour.
-- CreateTable
CREATE TABLE "TaskDone" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskDone_taskId_day_key" ON "TaskDone"("taskId", "day");

-- AddForeignKey
ALTER TABLE "TaskDone" ADD CONSTRAINT "TaskDone_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
