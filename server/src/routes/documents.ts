import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { Document } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { getStorage, MAX_FILE_SIZE, removeObjects, type Storage } from "../lib/storage";
import { patchSchema } from "../lib/validation";
import { FREE_DOCUMENT_LIMIT, hasUnlimitedDocuments } from "../lib/plan";

// Family document library + recipe attachments (see model Document).
// Upload is done in three steps so the file never goes through this API:
//   1. POST /documents             -> row created as 'pending' + signed PUT URL
//   2. the app PUTs the file directly to R2/S3
//   3. POST /documents/:id/confirm -> size checked in the bucket, row 'ready'

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

export const DOCUMENT_CATEGORIES = ["santé", "assurance", "école", "administratif", "maison", "autre"] as const;

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

// Uploads started but never confirmed (app closed, network lost…) are
// cleaned up the next time the same family starts an upload.
const PENDING_TTL_MS = 60 * 60 * 1000;

async function serializeDocument(doc: Document, storage: Storage | null) {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    memberId: doc.memberId,
    recipeId: doc.recipeId,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    size: doc.size,
    url: storage && doc.status === "ready" ? await storage.downloadUrl(doc.fileKey, doc.fileName) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function storageOr503(res: import("express").Response) {
  const storage = getStorage();
  if (!storage) {
    res.status(503).json({ error: "Le stockage des documents n'est pas configuré sur le serveur." });
    return null;
  }
  return storage;
}

// Members and recipes belong to the family.
async function ownsMember(familyId: string, memberId: string) {
  return !!(await prisma.familyMember.findFirst({ where: { id: memberId, userId: familyId }, select: { id: true } }));
}

/**
 * Where a document lives: recipe attachments belong to the family (everyone
 * sees the recipe); the library belongs to the account's private space.
 */
const scopeOf = (req: import("express").Request, recipeId: string | null | undefined) => (recipeId ? req.familyId! : req.privateId!);

async function ownsRecipe(userId: string, recipeId: string) {
  return !!(await prisma.recipe.findFirst({ where: { id: recipeId, userId }, select: { id: true } }));
}

const listQuery = z.object({
  recipeId: z.string().optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  memberId: z.string().optional(),
});

// Without recipeId: the family library. With recipeId: that recipe's attachments.
documentsRouter.get("/", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { recipeId, category, memberId } = parsed.data;

  const documents = await prisma.document.findMany({
    where: {
      userId: scopeOf(req, recipeId),
      status: "ready",
      recipeId: recipeId ?? null,
      ...(category ? { category } : {}),
      ...(memberId ? { memberId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const storage = getStorage();
  res.json({ documents: await Promise.all(documents.map((d) => serializeDocument(d, storage))) });
});

const createSchema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).default("autre"),
  memberId: z.string().nullable().optional(),
  recipeId: z.string().nullable().optional(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().refine((m) => m in MIME_EXTENSIONS, { message: "Seuls les photos (JPEG, PNG, WebP, HEIC) et les PDF sont acceptés." }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, { message: "Le fichier dépasse la taille maximale de 5 Mo." }),
});

documentsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const userId = scopeOf(req, d.recipeId);

  if (d.memberId && !(await ownsMember(req.familyId!, d.memberId))) return res.status(400).json({ error: "Membre inconnu" });
  if (d.recipeId && !(await ownsRecipe(req.familyId!, d.recipeId))) return res.status(400).json({ error: "Recette inconnue" });

  const storage = storageOr503(res);
  if (!storage) return;

  const stale = await prisma.document.findMany({
    where: { userId, status: "pending", createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
    select: { id: true, fileKey: true },
  });
  if (stale.length > 0) {
    await removeObjects(stale.map((s) => s.fileKey));
    await prisma.document.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  if (!(await hasUnlimitedDocuments(userId))) {
    const count = await prisma.document.count({ where: { userId } });
    if (count >= FREE_DOCUMENT_LIMIT) {
      return res.status(403).json({
        error: `La version gratuite garde jusqu'à ${FREE_DOCUMENT_LIMIT} documents. Avec Repas+, Budget+ ou Passerelle+, ils sont illimités.`,
        code: "premium_required",
      });
    }
  }

  const fileKey = `${userId}/${nanoid()}${MIME_EXTENSIONS[d.mimeType]}`;
  const title = d.title || d.fileName.replace(/\.[^.]+$/, "") || d.fileName;
  const document = await prisma.document.create({
    data: {
      userId,
      title,
      category: d.category,
      memberId: d.memberId ?? null,
      recipeId: d.recipeId ?? null,
      fileKey,
      fileName: d.fileName,
      mimeType: d.mimeType,
      size: d.size,
    },
  });

  res.status(201).json({
    document: await serializeDocument(document, storage),
    upload: { url: await storage.uploadUrl(fileKey, d.mimeType), method: "PUT", headers: { "Content-Type": d.mimeType } },
  });
});

/** The account's own documents, plus the family's recipe attachments. */
async function loadOwnedDocument(req: import("express").Request, id: string) {
  return prisma.document.findFirst({ where: { id, OR: [{ userId: req.privateId! }, { userId: req.familyId!, recipeId: { not: null } }] } });
}

documentsRouter.post("/:id/confirm", async (req, res) => {
  const existing = await loadOwnedDocument(req, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const storage = storageOr503(res);
  if (!storage) return;

  if (existing.status !== "ready") {
    const size = await storage.size(existing.fileKey);
    if (size === null) return res.status(400).json({ error: "Le fichier n'a pas été reçu. Réessaie l'envoi." });
    if (size > MAX_FILE_SIZE) {
      await removeObjects([existing.fileKey]);
      await prisma.document.delete({ where: { id: existing.id } });
      return res.status(400).json({ error: "Le fichier dépasse la taille maximale de 5 Mo." });
    }
    const document = await prisma.document.update({ where: { id: existing.id }, data: { status: "ready", size } });
    return res.json({ document: await serializeDocument(document, storage) });
  }
  res.json({ document: await serializeDocument(existing, storage) });
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  memberId: z.string().nullable(),
});

documentsRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(updateSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedDocument(req, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (parsed.data.memberId && !(await ownsMember(req.familyId!, parsed.data.memberId))) return res.status(400).json({ error: "Membre inconnu" });

  const document = await prisma.document.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ document: await serializeDocument(document, getStorage()) });
});

documentsRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedDocument(req, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await removeObjects([existing.fileKey]);
  await prisma.document.delete({ where: { id: existing.id } });
  res.status(204).end();
});
