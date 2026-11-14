-- Merchant → category choices remembered from bank statement imports.
CREATE TABLE "ImportRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImportRule_userId_key_key" ON "ImportRule"("userId", "key");

ALTER TABLE "ImportRule" ADD CONSTRAINT "ImportRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
