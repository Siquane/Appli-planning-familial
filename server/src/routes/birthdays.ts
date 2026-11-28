import { Router } from "express";
import { z } from "zod";
import type { BirthdayContact, GiftIdea } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

// Anniversaires : ceux des membres de la famille (leur fiche), ceux des
// proches (grands-parents, amis…), une liste d'idées de cadeaux par personne,
// et combien de jours avant être prévenu (les rappels sont programmés sur le
// téléphone). Les comptes enfants voient les dates, jamais les cadeaux.
export const birthdaysRouter = Router();
birthdaysRouter.use(requireAuth);

const MAX_CONTACTS = 100;
const MAX_GIFTS = 300;

const gift = (g: GiftIdea) => ({ id: g.id, memberId: g.memberId, contactId: g.contactId, title: g.title, bought: g.bought });
const contact = (c: BirthdayContact) => ({ id: c.id, name: c.name, birthday: c.birthday.toISOString().slice(0, 10), yearKnown: c.yearKnown, relation: c.relation });

birthdaysRouter.get("/", async (req, res) => {
  const familyId = req.userId!;
  const child = req.familyRole === "child";
  const [owner, contacts, gifts] = await Promise.all([
    prisma.user.findUnique({ where: { id: familyId }, select: { birthdayRemindDays: true } }),
    prisma.birthdayContact.findMany({ where: { userId: familyId }, orderBy: { name: "asc" } }),
    child ? Promise.resolve([]) : prisma.giftIdea.findMany({ where: { userId: familyId }, orderBy: { createdAt: "asc" } }),
  ]);
  res.json({ remindDays: owner?.birthdayRemindDays ?? 7, contacts: contacts.map(contact), gifts: gifts.map(gift) });
});

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis une date");
const contactSchema = z.object({
  name: z.string().trim().min(1, "Écris un prénom").max(60),
  birthday: day,
  yearKnown: z.boolean().default(false),
  relation: z.string().trim().max(40).default(""),
});

/** Le jour à midi UTC (pas de décalage de jour) ; année 2000 si on ne la connaît pas. */
function toDate(birthday: string, yearKnown: boolean) {
  return new Date(`${yearKnown ? birthday.slice(0, 4) : "2000"}${birthday.slice(4)}T12:00:00Z`);
}

birthdaysRouter.post("/contacts", async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  if ((await prisma.birthdayContact.count({ where: { userId: familyId } })) >= MAX_CONTACTS) return res.status(400).json({ error: `${MAX_CONTACTS} proches au plus.` });
  const d = parsed.data;
  const created = await prisma.birthdayContact.create({ data: { userId: familyId, name: d.name, relation: d.relation, yearKnown: d.yearKnown, birthday: toDate(d.birthday, d.yearKnown) } });
  res.status(201).json({ contact: contact(created) });
});

birthdaysRouter.patch("/contacts/:id", async (req, res) => {
  const parsed = contactSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.birthdayContact.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Cette personne n'est plus dans la liste." });
  const d = parsed.data;
  const yearKnown = d.yearKnown ?? existing.yearKnown;
  const updated = await prisma.birthdayContact.update({
    where: { id: existing.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.relation !== undefined ? { relation: d.relation } : {}),
      yearKnown,
      ...(d.birthday ? { birthday: toDate(d.birthday, yearKnown) } : {}),
    },
  });
  res.json({ contact: contact(updated) });
});

birthdaysRouter.delete("/contacts/:id", async (req, res) => {
  await prisma.birthdayContact.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.status(204).end();
});

const giftSchema = z
  .object({ title: z.string().trim().min(1, "Écris ton idée").max(120), memberId: z.string().optional(), contactId: z.string().optional() })
  .refine((g) => !!g.memberId !== !!g.contactId, "Pour qui est ce cadeau ?");

birthdaysRouter.post("/gifts", async (req, res) => {
  const parsed = giftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  const d = parsed.data;
  const owner = d.memberId
    ? await prisma.familyMember.findFirst({ where: { id: d.memberId, userId: familyId } })
    : await prisma.birthdayContact.findFirst({ where: { id: d.contactId, userId: familyId } });
  if (!owner) return res.status(404).json({ error: "Cette personne n'est plus dans la liste." });
  if ((await prisma.giftIdea.count({ where: { userId: familyId } })) >= MAX_GIFTS) return res.status(400).json({ error: "Trop d'idées : supprime celles déjà offertes." });
  const created = await prisma.giftIdea.create({ data: { userId: familyId, title: d.title, memberId: d.memberId ?? null, contactId: d.contactId ?? null } });
  res.status(201).json({ gift: gift(created) });
});

birthdaysRouter.patch("/gifts/:id", async (req, res) => {
  const parsed = z.object({ title: z.string().trim().min(1).max(120).optional(), bought: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.giftIdea.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Cette idée a été supprimée." });
  const updated = await prisma.giftIdea.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ gift: gift(updated) });
});

birthdaysRouter.delete("/gifts/:id", async (req, res) => {
  await prisma.giftIdea.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.status(204).end();
});

birthdaysRouter.put("/settings", async (req, res) => {
  const parsed = z.object({ remindDays: z.number().int().min(0).max(30) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choisis entre 0 et 30 jours." });
  await prisma.user.update({ where: { id: req.userId }, data: { birthdayRemindDays: parsed.data.remindDays } });
  res.json({ remindDays: parsed.data.remindDays });
});
