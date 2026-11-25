-- CreateTable
CREATE TABLE "OAuthTicket" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthTicket_tokenHash_key" ON "OAuthTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "OAuthTicket_expiresAt_idx" ON "OAuthTicket"("expiresAt");

