import { Router } from "express";
import { z } from "zod";
import type { Note } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { patchSchema } from "../lib/validation";

// Notes de la famille (« Famille », vues par tous ses comptes) et notes perso
// (« Perso », vues par leur auteur seulement). Voir le modèle Note.
export const notesRouter = Router();
notesRouter.use(requireAuth);

export const NOTE_COLORS = ["default", "cyan", "blue", "lavender", "violet", "green", "amber"] as const;
const MAX_NOTES = 500;

function serialize(n: Note & { author?: { name: string } | null }, accountId: string) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    shared: n.shared,
    color: n.color,
    pinned: n.pinned,
    mine: n.authorId === accountId,
    authorName: n.author?.name ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

/** Les notes que ce compte peut voir : celles de sa famille et les siennes. */
function visible(familyId: string, accountId: string) {
  return { OR: [{ userId: familyId, shared: true }, { userId: accountId, shared: false }] };
}

const include = { author: { select: { name: true } } } as const;

notesRouter.get("/", async (req, res) => {
  const notes = await prisma.note.findMany({
    where: visible(req.familyId!, req.accountId!),
    include,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  res.json({ notes: notes.map((n) => serialize(n, req.accountId!)) });
});

const noteSchema = z
  .object({
    title: z.string().trim().max(120).default(""),
    body: z.string().max(10_000).default(""),
    shared: z.boolean().default(true),
    color: z.enum(NOTE_COLORS).default("default"),
    pinned: z.boolean().default(false),
  })
  .refine((n) => n.title.length > 0 || n.body.trim().length > 0, "La note est vide");

notesRouter.post("/", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const count = await prisma.note.count({ where: visible(req.familyId!, req.accountId!) });
  if (count >= MAX_NOTES) return res.status(400).json({ error: `${MAX_NOTES} notes au plus` });
  const d = parsed.data;
  const note = await prisma.note.create({
    data: { ...d, userId: d.shared ? req.familyId! : req.accountId!, authorId: req.accountId! },
    include,
  });
  res.status(201).json({ note: serialize(note, req.accountId!) });
});

const patch = patchSchema(
  z.object({
    title: z.string().trim().max(120),
    body: z.string().max(10_000),
    shared: z.boolean(),
    color: z.enum(NOTE_COLORS),
    pinned: z.boolean(),
  }),
);

async function loadVisible(id: string, familyId: string, accountId: string) {
  return prisma.note.findFirst({ where: { id, ...visible(familyId, accountId) } });
}

notesRouter.patch("/:id", async (req, res) => {
  const parsed = patch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadVisible(req.params.id, req.familyId!, req.accountId!);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const d = parsed.data;
  // Une note de la famille ne devient perso que pour celui qui l'a écrite.
  if (d.shared === false && existing.shared && existing.authorId !== req.accountId) {
    return res.status(403).json({ error: "Seule la personne qui a écrit cette note peut la rendre perso." });
  }
  const title = d.title ?? existing.title;
  const body = d.body ?? existing.body;
  if (!title && !body.trim()) return res.status(400).json({ error: "La note est vide" });
  const shared = d.shared ?? existing.shared;
  const note = await prisma.note.update({
    where: { id: existing.id },
    data: { ...d, userId: shared ? req.familyId! : req.accountId! },
    include,
  });
  res.json({ note: serialize(note, req.accountId!) });
});

notesRouter.delete("/:id", async (req, res) => {
  const existing = await loadVisible(req.params.id, req.familyId!, req.accountId!);
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.note.delete({ where: { id: existing.id } });
  res.status(204).end();
});
