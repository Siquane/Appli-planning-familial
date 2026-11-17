import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { isChild, isMondayKey } from "../lib/stars";

// Étoiles des enfants : un adulte (tout compte connecté a 15 ans ou plus)
// coche une tâche faite, les étoiles s'ajoutent ; elles s'échangent contre
// des récompenses définies par la famille.
export const starsRouter = Router();
starsRouter.use(requireAuth);

const week = z.string().refine(isMondayKey, "Semaine invalide");

async function childOf(familyId: string, memberId: string) {
  const member = await prisma.familyMember.findFirst({ where: { id: memberId, userId: familyId } });
  return member && isChild(member) ? member : null;
}

async function balances(familyId: string) {
  const [earned, spent] = await Promise.all([
    prisma.starCompletion.groupBy({ by: ["memberId"], where: { userId: familyId }, _sum: { stars: true } }),
    prisma.rewardRedemption.groupBy({ by: ["memberId"], where: { userId: familyId }, _sum: { cost: true } }),
  ]);
  const out = new Map<string, { earned: number; spent: number }>();
  for (const e of earned) out.set(e.memberId, { earned: e._sum.stars ?? 0, spent: 0 });
  for (const s of spent) out.set(s.memberId, { earned: out.get(s.memberId)?.earned ?? 0, spent: s._sum.cost ?? 0 });
  return out;
}

starsRouter.get("/", async (req, res) => {
  const parsed = week.safeParse(req.query.week);
  if (!parsed.success) return res.status(400).json({ error: "Semaine invalide" });
  const familyId = req.userId!;
  const [members, completions, rewards, history, totals] = await Promise.all([
    prisma.familyMember.findMany({ where: { userId: familyId }, orderBy: { order: "asc" } }),
    prisma.starCompletion.findMany({ where: { userId: familyId, week: parsed.data } }),
    prisma.reward.findMany({ where: { userId: familyId }, orderBy: { cost: "asc" } }),
    Promise.all([
      prisma.starCompletion.findMany({ where: { userId: familyId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.rewardRedemption.findMany({ where: { userId: familyId }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]),
    balances(familyId),
  ]);
  const children = members.filter((m) => isChild(m));
  const events = [
    ...history[0].map((c) => ({ id: c.id, kind: "earned" as const, memberId: c.memberId, title: c.title, stars: c.stars, createdAt: c.createdAt })),
    ...history[1].map((r) => ({ id: r.id, kind: "spent" as const, memberId: r.memberId, title: r.title, stars: r.cost, createdAt: r.createdAt })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 30)
    .map((e) => ({ ...e, createdAt: e.createdAt.toISOString() }));

  res.json({
    children: children.map((m) => {
      const t = totals.get(m.id) ?? { earned: 0, spent: 0 };
      const weekStars = completions.filter((c) => c.memberId === m.id).reduce((n, c) => n + c.stars, 0);
      return { memberId: m.id, balance: t.earned - t.spent, weekStars };
    }),
    completions: completions.filter((c) => c.taskId).map((c) => ({ taskId: c.taskId!, memberId: c.memberId, stars: c.stars })),
    rewards: rewards.map((r) => ({ id: r.id, title: r.title, cost: r.cost })),
    history: events,
  });
});

const completeSchema = z.object({ taskId: z.string(), memberId: z.string(), week });

starsRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const familyId = req.userId!;
  const task = await prisma.task.findFirst({ where: { id: d.taskId, userId: familyId }, include: { members: true } });
  if (!task) return res.status(404).json({ error: "Tâche introuvable" });
  if (!task.members.some((m) => m.memberId === d.memberId)) return res.status(400).json({ error: "Cette tâche n'est pas assignée à ce membre" });
  if (!(await childOf(familyId, d.memberId))) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans" });
  if (task.stars === 0) return res.status(400).json({ error: "Cette tâche ne rapporte pas d'étoile" });

  const completion = await prisma.starCompletion.upsert({
    where: { taskId_memberId_week: { taskId: task.id, memberId: d.memberId, week: d.week } },
    create: { userId: familyId, taskId: task.id, memberId: d.memberId, week: d.week, title: task.title, stars: task.stars },
    update: {},
  });
  res.status(201).json({ completion: { taskId: completion.taskId, memberId: completion.memberId, stars: completion.stars } });
});

// Annuler une coche (erreur de l'adulte) : les étoiles sont retirées.
starsRouter.delete("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  await prisma.starCompletion.deleteMany({ where: { userId: req.userId, taskId: d.taskId, memberId: d.memberId, week: d.week } });
  res.status(204).end();
});

const rewardSchema = z.object({ title: z.string().trim().min(1).max(80), cost: z.number().int().min(1).max(1000) });

starsRouter.post("/rewards", async (req, res) => {
  const parsed = rewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const count = await prisma.reward.count({ where: { userId: req.userId } });
  if (count >= 30) return res.status(400).json({ error: "30 récompenses au plus" });
  const reward = await prisma.reward.create({ data: { userId: req.userId!, ...parsed.data } });
  res.status(201).json({ reward: { id: reward.id, title: reward.title, cost: reward.cost } });
});

starsRouter.patch("/rewards/:id", async (req, res) => {
  const parsed = rewardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.reward.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const reward = await prisma.reward.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ reward: { id: reward.id, title: reward.title, cost: reward.cost } });
});

starsRouter.delete("/rewards/:id", async (req, res) => {
  await prisma.reward.deleteMany({ where: { id: req.params.id, userId: req.userId } });
  res.status(204).end();
});

starsRouter.post("/rewards/:id/redeem", async (req, res) => {
  const parsed = z.object({ memberId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  const reward = await prisma.reward.findFirst({ where: { id: req.params.id, userId: familyId } });
  if (!reward) return res.status(404).json({ error: "Not found" });
  if (!(await childOf(familyId, parsed.data.memberId))) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans" });
  const t = (await balances(familyId)).get(parsed.data.memberId) ?? { earned: 0, spent: 0 };
  const balance = t.earned - t.spent;
  if (balance < reward.cost) return res.status(409).json({ error: `Il manque ${reward.cost - balance} étoile${reward.cost - balance > 1 ? "s" : ""}.`, code: "not_enough_stars" });
  await prisma.rewardRedemption.create({ data: { userId: familyId, memberId: parsed.data.memberId, rewardId: reward.id, title: reward.title, cost: reward.cost } });
  res.status(201).json({ balance: balance - reward.cost });
});

// Effacer une ligne de l'historique (récompense échangée par erreur, par exemple).
starsRouter.delete("/history/:id", async (req, res) => {
  await prisma.$transaction([
    prisma.starCompletion.deleteMany({ where: { id: req.params.id, userId: req.userId } }),
    prisma.rewardRedemption.deleteMany({ where: { id: req.params.id, userId: req.userId } }),
  ]);
  res.status(204).end();
});
