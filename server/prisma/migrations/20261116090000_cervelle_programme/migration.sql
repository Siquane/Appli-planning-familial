-- Cervelle : révisions calées sur le programme officiel (chapitre, notions ajoutées).
ALTER TABLE "Revision" ADD COLUMN "programmeChapterId" TEXT;
ALTER TABLE "Notion" ADD COLUMN "fromProgramme" BOOLEAN NOT NULL DEFAULT false;
