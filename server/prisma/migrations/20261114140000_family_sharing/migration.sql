-- Family sharing: several accounts around the same family data.
ALTER TABLE "User" ADD COLUMN "familyOwnerId" TEXT,
ADD COLUMN "familyRole" TEXT NOT NULL DEFAULT 'owner';

ALTER TABLE "User" ADD CONSTRAINT "User_familyOwnerId_fkey" FOREIGN KEY ("familyOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FamilyInvite" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyInvite_ownerId_key" ON "FamilyInvite"("ownerId");
CREATE UNIQUE INDEX "FamilyInvite_code_key" ON "FamilyInvite"("code");

ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
