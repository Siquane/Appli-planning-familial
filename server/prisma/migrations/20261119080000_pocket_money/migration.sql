-- CreateTable
CREATE TABLE "PocketMoneyRule" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "startDay" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PocketMoneyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PocketMoneyCredit" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PocketMoneyCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PocketMoneyRule_accountId_key" ON "PocketMoneyRule"("accountId");

-- CreateIndex
CREATE INDEX "PocketMoneyCredit_accountId_day_idx" ON "PocketMoneyCredit"("accountId", "day");

-- AddForeignKey
ALTER TABLE "PocketMoneyRule" ADD CONSTRAINT "PocketMoneyRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PocketMoneyCredit" ADD CONSTRAINT "PocketMoneyCredit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

