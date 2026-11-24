-- CreateTable
CREATE TABLE "PocketMoneyAdvance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "repaidCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PocketMoneyAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PocketMoneyAdvance_accountId_idx" ON "PocketMoneyAdvance"("accountId");

-- AddForeignKey
ALTER TABLE "PocketMoneyAdvance" ADD CONSTRAINT "PocketMoneyAdvance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

