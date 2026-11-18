import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { addDays, mondayOf, parisDay } from "../lib/cervelle/days";
import { isMondayKey } from "../lib/stars";
import { renderSharePage } from "../lib/sharePage";

export const shareRouter = Router();

shareRouter.get("/", requireAuth, async (req, res) => {
  const [link, sharedWith] = await Promise.all([
    prisma.shareLink.upsert({
      where: { userId: req.userId! },
      update: {},
      create: { userId: req.userId!, token: nanoid(10) },
    }),
    prisma.sharedPerson.findMany({ where: { userId: req.userId } }),
  ]);
  res.json({ shareToken: link.token, sharedWith });
});

const inviteSchema = z.object({ name: z.string().min(1), role: z.string().default("Invité") });

shareRouter.post("/people", requireAuth, async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const person = await prisma.sharedPerson.create({ data: { userId: req.userId!, name: parsed.data.name, role: parsed.data.role } });
  res.status(201).json({ person });
});

shareRouter.delete("/people/:id", requireAuth, async (req, res) => {
  const existing = await prisma.sharedPerson.findFirst({ where: { id: String(req.params.id), userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.sharedPerson.delete({ where: { id: existing.id } });
  res.status(204).end();
});

// Public read-only view of a shared planning, resolved by share token — what
// an invited person (per the design brief: "pour qu'ils puissent voir les
// tâches synchronisées") sees without needing an account.
shareRouter.get("/public/:token", async (req, res) => {
  const link = await prisma.shareLink.findUnique({ where: { token: req.params.token } });
  if (!link) return res.status(404).json({ error: "Lien invalide" });
  const [owner, tasks] = await Promise.all([
    prisma.user.findUnique({ where: { id: link.userId } }),
    prisma.task.findMany({
      where: { userId: link.userId, synced: true },
      include: { members: { include: { member: true } } },
      orderBy: [{ weekday: "asc" }, { time: "asc" }],
    }),
  ]);
  res.json({
    ownerName: owner?.name ?? "",
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      weekday: t.weekday,
      time: t.time,
      recurring: t.recurring,
      appointmentDate: t.appointmentDate,
      members: t.members.map((m) => m.member.name),
    })),
  });
});

// ---------------------------------------------------------------------------
// Liens par membre : la semaine d'une seule personne (nounou, grand-parent…),
// en page web, sans compte.

shareRouter.get("/members", requireAuth, async (req, res) => {
  const members = await prisma.familyMember.findMany({ where: { userId: req.userId! }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  const withTokens = await Promise.all(
    members.map((m) => (m.shareToken ? m : prisma.familyMember.update({ where: { id: m.id }, data: { shareToken: nanoid(16) } }))),
  );
  res.json({ links: withTokens.map((m) => ({ memberId: m.id, name: m.name, token: m.shareToken })) });
});

// Nouveau lien : l'ancien cesse de fonctionner.
shareRouter.post("/members/:id/reset", requireAuth, async (req, res) => {
  const member = await prisma.familyMember.findFirst({ where: { id: String(req.params.id), userId: req.userId! } });
  if (!member) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.familyMember.update({ where: { id: member.id }, data: { shareToken: nanoid(16) } });
  res.json({ memberId: updated.id, name: updated.name, token: updated.shareToken });
});

shareRouter.get("/m/:token", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  const member = await prisma.familyMember.findUnique({ where: { shareToken: req.params.token } });
  if (!member) {
    return res.status(404).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lien expiré · Passerelle</title><body style="background:#070912;color:#E8F4FF;font-family:system-ui;padding:32px 16px;text-align:center"><p>Ce lien de planning n'est plus valable. Demande un nouveau lien à la famille.</p></body>`);
  }
  const today = parisDay();
  const week = typeof req.query.week === "string" && isMondayKey(req.query.week) ? req.query.week : mondayOf(today);
  const tasks = await prisma.task.findMany({
    where: {
      userId: member.userId,
      members: { some: { memberId: member.id } },
      OR: [{ appointmentDate: null }, { appointmentDate: { gte: week, lte: addDays(week, 6) } }],
    },
    select: { title: true, category: true, weekday: true, time: true, duration: true, appointmentDate: true, location: true },
  });
  res.type("html").send(renderSharePage({ memberName: member.name, week, today, tasks, selfPath: `${req.baseUrl}/m/${member.shareToken}` }));
});
