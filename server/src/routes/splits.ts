import { Router, type Response } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { getStorage, MAX_FILE_SIZE, removeObjects } from "../lib/storage";
import { balances, computeShares, settleUp, SPLIT_MODES, SplitError } from "../lib/splits";

// Comptes partagés (onglet « Comptes ») : des groupes de personnes qui
// partagent des dépenses, qui a payé quoi, et qui doit combien à qui.
// Les groupes appartiennent à la famille : tous ses comptes les voient.
export const splitsRouter = Router();
splitsRouter.use(requireAuth);

const MAX_GROUPS = 100;
const MAX_PARTICIPANTS = 30;
const PHOTO_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic" } as const;

export const groupInclude = {
  participants: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
  expenses: { include: { shares: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
} satisfies Prisma.SplitGroupInclude;
export type FullGroup = Prisma.SplitGroupGetPayload<{ include: typeof groupInclude }>;

export async function loadGroup(familyId: string, id: string): Promise<FullGroup | null> {
  return prisma.splitGroup.findFirst({ where: { id, userId: familyId }, include: groupInclude });
}

function summary(g: FullGroup) {
  const bal = balances(
    g.participants.map((p) => p.id),
    g.expenses,
  );
  const spent = g.expenses.filter((e) => e.kind === "expense").reduce((n, e) => n + e.amountCents, 0);
  return { bal, spent, transfers: settleUp(bal) };
}

function serializeParticipant(p: FullGroup["participants"][number], used: Set<string>, withLinks: boolean) {
  return { id: p.id, name: p.name, memberId: p.memberId, used: used.has(p.id), ...(withLinks ? { linkToken: p.linkToken } : {}) };
}

/** Une photo annoncée n'est montrée qu'une fois arrivée dans le stockage ; ratée depuis une heure, elle est oubliée. */
const PHOTO_GIVE_UP_MS = 60 * 60_000;
async function photoReady(e: FullGroup["expenses"][number], storage: ReturnType<typeof getStorage>): Promise<boolean> {
  if (!e.photoKey || !storage) return false;
  if (!e.photoPending) return true;
  const size = await storage.size(e.photoKey).catch(() => null);
  if (size !== null) {
    await prisma.splitExpense.update({ where: { id: e.id }, data: { photoPending: false } });
    return true;
  }
  if (Date.now() - e.updatedAt.getTime() > PHOTO_GIVE_UP_MS) {
    await prisma.splitExpense.update({ where: { id: e.id }, data: { photoKey: null, photoMime: null, photoPending: false } });
  }
  return false;
}

/** `withLinks`: the family sees each person's link secret; the web page never does. */
export async function serializeGroup(g: FullGroup, withExpenses: boolean, withLinks = true) {
  const { bal, spent, transfers } = summary(g);
  const used = new Set(g.expenses.flatMap((e) => [e.paidById, ...e.shares.map((s) => s.participantId)]));
  const storage = withExpenses ? getStorage() : null;
  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji,
    defaultSplit: g.defaultSplit ?? null,
    archived: !!g.archivedAt,
    spentCents: spent,
    expenseCount: g.expenses.filter((e) => e.kind === "expense").length,
    lastActivity: (g.expenses[0]?.createdAt ?? g.createdAt).toISOString(),
    participants: g.participants.map((p) => serializeParticipant(p, used, withLinks)),
    balances: g.participants.map((p) => ({ participantId: p.id, cents: bal.get(p.id) ?? 0 })),
    transfers,
    ...(withExpenses
      ? {
          expenses: await Promise.all(
            g.expenses.map(async (e) => ({
              id: e.id,
              title: e.title,
              amountCents: e.amountCents,
              paidById: e.paidById,
              date: e.date.toISOString().slice(0, 10),
              mode: e.mode,
              kind: e.kind,
              shares: e.shares.map((s) => ({ participantId: s.participantId, value: s.value, amountCents: s.amountCents })),
              addedById: e.addedById,
              photoUrl: storage && (await photoReady(e, storage)) ? await storage.downloadUrl(e.photoKey!, `ticket${PHOTO_TYPES[e.photoMime as keyof typeof PHOTO_TYPES] ?? ".jpg"}`).catch(() => null) : null,
              createdAt: e.createdAt.toISOString(),
            })),
          ),
        }
      : {}),
  };
}

function fail(res: Response, e: unknown) {
  if (e instanceof SplitError) return res.status(400).json({ error: e.message });
  throw e;
}

// ── Groupes ──

splitsRouter.get("/", async (req, res) => {
  const groups = await prisma.splitGroup.findMany({ where: { userId: req.familyId! }, include: groupInclude, orderBy: { updatedAt: "desc" } });
  res.json({ groups: await Promise.all(groups.map((g) => serializeGroup(g, false))) });
});

const participantInput = z.object({ name: z.string().trim().min(1, "Indique un prénom").max(40), memberId: z.string().nullable().optional() });

const groupSchema = z.object({
  name: z.string().trim().min(1, "Donne un nom au groupe").max(60),
  emoji: z.string().trim().min(1).max(8).default("💸"),
  participants: z.array(participantInput).min(2, "Il faut au moins deux personnes").max(MAX_PARTICIPANTS),
});

async function checkMembers(familyId: string, ids: (string | null | undefined)[]) {
  const wanted = [...new Set(ids.filter((x): x is string => !!x))];
  if (!wanted.length) return true;
  const found = await prisma.familyMember.count({ where: { id: { in: wanted }, userId: familyId } });
  return found === wanted.length;
}

splitsRouter.post("/", async (req, res) => {
  const parsed = groupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.familyId!;
  if ((await prisma.splitGroup.count({ where: { userId: familyId } })) >= MAX_GROUPS) return res.status(400).json({ error: "Trop de groupes : archive ou supprime-en un." });
  if (!(await checkMembers(familyId, parsed.data.participants.map((p) => p.memberId)))) return res.status(400).json({ error: "Membre inconnu" });
  const g = await prisma.splitGroup.create({
    data: {
      userId: familyId,
      name: parsed.data.name,
      emoji: parsed.data.emoji,
      participants: { create: parsed.data.participants.map((p, i) => ({ name: p.name, memberId: p.memberId ?? null, order: i })) },
    },
    include: groupInclude,
  });
  res.status(201).json({ group: await serializeGroup(g, true) });
});

splitsRouter.get("/:id", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  res.json({ group: await serializeGroup(g, true) });
});

const defaultSplitSchema = z.object({ mode: z.enum(SPLIT_MODES), values: z.record(z.string(), z.number().int().min(0)) }).nullable();

const groupPatch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  archived: z.boolean().optional(),
  defaultSplit: defaultSplitSchema.optional(),
});

splitsRouter.patch("/:id", async (req, res) => {
  const parsed = groupPatch.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  const { archived, defaultSplit, ...rest } = parsed.data;
  await prisma.splitGroup.update({
    where: { id: g.id },
    data: {
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      ...(defaultSplit === undefined ? {} : { defaultSplit: defaultSplit === null ? Prisma.DbNull : defaultSplit }),
    },
  });
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.delete("/:id", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  const keys = g.expenses.map((e) => e.photoKey).filter((k): k is string => !!k);
  await prisma.splitGroup.delete({ where: { id: g.id } });
  if (keys.length) await removeObjects(keys).catch(() => undefined);
  res.status(204).end();
});

// ── Participants ──

splitsRouter.post("/:id/participants", async (req, res) => {
  const parsed = participantInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  if (g.participants.length >= MAX_PARTICIPANTS) return res.status(400).json({ error: "Ce groupe est complet." });
  if (!(await checkMembers(req.familyId!, [parsed.data.memberId]))) return res.status(400).json({ error: "Membre inconnu" });
  await prisma.splitParticipant.create({ data: { groupId: g.id, name: parsed.data.name, memberId: parsed.data.memberId ?? null, order: g.participants.length } });
  res.status(201).json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.patch("/:id/participants/:pid", async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  const p = g?.participants.find((x) => x.id === req.params.pid);
  if (!g || !p) return res.status(404).json({ error: "Introuvable" });
  await prisma.splitParticipant.update({ where: { id: p.id }, data: { name: parsed.data.name } });
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.delete("/:id/participants/:pid", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  const p = g?.participants.find((x) => x.id === req.params.pid);
  if (!g || !p) return res.status(404).json({ error: "Introuvable" });
  const used = g.expenses.some((e) => e.paidById === p.id || e.shares.some((s) => s.participantId === p.id));
  if (used) return res.status(409).json({ error: `${p.name} apparaît dans des dépenses : retire-le d'abord de ces dépenses.` });
  if (g.participants.length <= 2) return res.status(400).json({ error: "Il faut au moins deux personnes." });
  await prisma.splitParticipant.delete({ where: { id: p.id } });
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

// ── Lien de chaque personne (page web sans compte, routes/splitsPublic.ts) ──

/** Crée le lien d'une personne, ou en donne un nouveau : l'ancien cesse de fonctionner. */
splitsRouter.post("/:id/participants/:pid/link", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  const p = g?.participants.find((x) => x.id === req.params.pid);
  if (!g || !p) return res.status(404).json({ error: "Introuvable" });
  await prisma.splitParticipant.update({ where: { id: p.id }, data: { linkToken: nanoid(24) } });
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.delete("/:id/participants/:pid/link", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  const p = g?.participants.find((x) => x.id === req.params.pid);
  if (!g || !p) return res.status(404).json({ error: "Introuvable" });
  await prisma.splitParticipant.update({ where: { id: p.id }, data: { linkToken: null } });
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

// ── Dépenses ──

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "Indique ce qui a été payé").max(80),
  amountCents: z.number().int().min(1, "Indique un montant").max(100_000_000),
  paidById: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(SPLIT_MODES).default("equal"),
  shares: z.array(z.object({ participantId: z.string(), value: z.number().int().min(0) })).min(1, "Choisis au moins une personne"),
  /** Remember this split for the next expenses of the group. */
  remember: z.boolean().default(false),
  photo: z.object({ mimeType: z.enum(Object.keys(PHOTO_TYPES) as [keyof typeof PHOTO_TYPES]), size: z.number().int().min(1) }).nullable().optional(),
});

/** Checks the people and computes the shares, or answers 400. */
export function prepare(res: Response, g: FullGroup, d: z.infer<typeof expenseSchema>) {
  const ids = new Set(g.participants.map((p) => p.id));
  if (!ids.has(d.paidById) || d.shares.some((s) => !ids.has(s.participantId))) {
    res.status(400).json({ error: "Personne inconnue dans ce groupe" });
    return null;
  }
  try {
    return computeShares(d.amountCents, d.mode, d.shares);
  } catch (e) {
    fail(res, e);
    return null;
  }
}

export async function photoUpload(res: Response, familyId: string, photo: z.infer<typeof expenseSchema>["photo"]) {
  if (!photo) return { key: null, mime: null, upload: null };
  const storage = getStorage();
  if (!storage) {
    res.status(503).json({ error: "Le stockage des photos n'est pas configuré sur le serveur." });
    return null;
  }
  if (photo.size > MAX_FILE_SIZE) {
    res.status(400).json({ error: "La photo dépasse 5 Mo." });
    return null;
  }
  const key = `${familyId}/splits/${nanoid()}${PHOTO_TYPES[photo.mimeType]}`;
  return { key, mime: photo.mimeType, upload: { url: await storage.uploadUrl(key, photo.mimeType), method: "PUT", headers: { "Content-Type": photo.mimeType } } };
}

splitsRouter.post("/:id/expenses", async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  const d = parsed.data;
  const shares = prepare(res, g, d);
  if (!shares) return;
  const photo = await photoUpload(res, req.familyId!, d.photo);
  if (!photo) return;
  const e = await prisma.splitExpense.create({
    data: {
      groupId: g.id,
      title: d.title,
      amountCents: d.amountCents,
      paidById: d.paidById,
      date: new Date(`${d.date}T00:00:00Z`),
      mode: d.mode,
      photoKey: photo.key,
      photoMime: photo.mime,
      photoPending: !!photo.upload,
      shares: { create: shares },
    },
  });
  await prisma.splitGroup.update({
    where: { id: g.id },
    data: d.remember ? { defaultSplit: { mode: d.mode, values: Object.fromEntries(shares.map((s) => [s.participantId, s.value])) } } : { updatedAt: new Date() },
  });
  res.status(201).json({ expenseId: e.id, upload: photo.upload, group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.put("/:id/expenses/:eid", async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  const existing = g?.expenses.find((x) => x.id === req.params.eid);
  if (!g || !existing) return res.status(404).json({ error: "Dépense introuvable" });
  const d = parsed.data;
  const shares = prepare(res, g, d);
  if (!shares) return;
  // A new photo replaces the old one; no « photo » keeps it.
  const photo = d.photo ? await photoUpload(res, req.familyId!, d.photo) : { key: existing.photoKey, mime: existing.photoMime, upload: null };
  if (!photo) return;
  await prisma.$transaction([
    prisma.splitShare.deleteMany({ where: { expenseId: existing.id } }),
    prisma.splitExpense.update({
      where: { id: existing.id },
      data: { title: d.title, amountCents: d.amountCents, paidById: d.paidById, date: new Date(`${d.date}T00:00:00Z`), mode: d.mode, photoKey: photo.key, photoMime: photo.mime, ...(photo.upload ? { photoPending: true } : {}), shares: { create: shares } },
    }),
  ]);
  if (d.photo && existing.photoKey) await removeObjects([existing.photoKey]).catch(() => undefined);
  res.json({ expenseId: existing.id, upload: photo.upload, group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.delete("/:id/expenses/:eid/photo", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  const existing = g?.expenses.find((x) => x.id === req.params.eid);
  if (!g || !existing) return res.status(404).json({ error: "Dépense introuvable" });
  if (existing.photoKey) {
    await prisma.splitExpense.update({ where: { id: existing.id }, data: { photoKey: null, photoMime: null, photoPending: false } });
    await removeObjects([existing.photoKey]).catch(() => undefined);
  }
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

splitsRouter.delete("/:id/expenses/:eid", async (req, res) => {
  const g = await loadGroup(req.familyId!, req.params.id);
  const existing = g?.expenses.find((x) => x.id === req.params.eid);
  if (!g || !existing) return res.status(404).json({ error: "Dépense introuvable" });
  await prisma.splitExpense.delete({ where: { id: existing.id } });
  if (existing.photoKey) await removeObjects([existing.photoKey]).catch(() => undefined);
  res.json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});

// ── Rembourser ──

const settleSchema = z.object({ fromId: z.string(), toId: z.string(), amountCents: z.number().int().min(1).max(100_000_000), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** « Marc a remboursé 40 € à Anaïs » : enregistré comme un virement de Marc, entièrement pour Anaïs. */
splitsRouter.post("/:id/settle", async (req, res) => {
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const g = await loadGroup(req.familyId!, req.params.id);
  if (!g) return res.status(404).json({ error: "Groupe introuvable" });
  const { fromId, toId, amountCents } = parsed.data;
  const from = g.participants.find((p) => p.id === fromId);
  const to = g.participants.find((p) => p.id === toId);
  if (!from || !to || fromId === toId) return res.status(400).json({ error: "Personne inconnue dans ce groupe" });
  await prisma.splitExpense.create({
    data: {
      groupId: g.id,
      title: `${from.name} → ${to.name}`,
      amountCents,
      paidById: fromId,
      date: new Date(`${parsed.data.date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`),
      mode: "amount",
      kind: "transfer",
      shares: { create: [{ participantId: toId, value: amountCents, amountCents }] },
    },
  });
  await prisma.splitGroup.update({ where: { id: g.id }, data: { updatedAt: new Date() } });
  res.status(201).json({ group: await serializeGroup((await loadGroup(req.familyId!, g.id))!, true) });
});
