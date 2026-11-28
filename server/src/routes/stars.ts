import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { isChild, isMondayKey, seriesBonuses, SERIES_LEVELS } from "../lib/stars";
import { pushToAccounts } from "../lib/familyAlerts";

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

/** Remet à jour les bonus de série d'un enfant pour la série de cette tâche, cette semaine. */
async function syncSeriesBonus(familyId: string, task: { seriesId: string | null; title: string }, memberId: string, week: string) {
  if (!task.seriesId) return;
  const prefix = `${memberId}:${task.seriesId}:${week}:`;
  const series = await prisma.task.findMany({ where: { userId: familyId, seriesId: task.seriesId }, select: { id: true, weekday: true } });
  const done = await prisma.starCompletion.findMany({ where: { userId: familyId, memberId, week, taskId: { in: series.map((t) => t.id) } }, select: { taskId: true } });
  const weekdays = done.map((c) => series.find((t) => t.id === c.taskId)!.weekday);
  const wanted = seriesBonuses(weekdays).map((l) => ({ key: `${prefix}${l.days}`, ...l }));
  await prisma.starCompletion.deleteMany({ where: { userId: familyId, bonusKey: { startsWith: prefix, notIn: wanted.map((w) => w.key) } } });
  for (const w of wanted) {
    await prisma.starCompletion.upsert({
      where: { bonusKey: w.key },
      create: { userId: familyId, memberId, week, title: `Série : ${task.title}, ${w.days} jours de suite`, stars: w.stars, bonusKey: w.key },
      update: {},
    });
  }
}

/** Étoiles gagnées cette semaine par tous les enfants (l'objectif commun). */
async function weekProgress(familyId: string, week: string) {
  const sum = await prisma.starCompletion.aggregate({ where: { userId: familyId, week }, _sum: { stars: true } });
  return sum._sum.stars ?? 0;
}

/** Objectif commun atteint cette semaine : toute la famille est prévenue, une fois. */
async function checkGoal(familyId: string, week: string) {
  const goal = await prisma.familyGoal.findUnique({ where: { userId: familyId } });
  if (!goal || goal.reachedWeek === week) return;
  if ((await weekProgress(familyId, week)) < goal.target) return;
  const done = await prisma.familyGoal.updateMany({ where: { id: goal.id, OR: [{ reachedWeek: null }, { reachedWeek: { not: week } }] }, data: { reachedWeek: week } });
  if (done.count === 0) return;
  const accounts = await prisma.user.findMany({ where: { OR: [{ id: familyId }, { familyOwnerId: familyId }] }, select: { id: true } });
  await pushToAccounts(accounts.map((a) => a.id), `Objectif de la semaine atteint : ${goal.title} ! Bravo à tous 🎉`, "/stars").catch((e) => console.error("Goal push failed:", e));
}

/** Coche une tâche faite pour un enfant (adulte, ou demande validée). */
async function complete(familyId: string, task: { id: string; title: string; stars: number; seriesId: string | null }, memberId: string, week: string) {
  const completion = await prisma.starCompletion.upsert({
    where: { taskId_memberId_week: { taskId: task.id, memberId, week } },
    create: { userId: familyId, taskId: task.id, memberId, week, title: task.title, stars: task.stars },
    update: {},
  });
  await syncSeriesBonus(familyId, task, memberId, week);
  await checkGoal(familyId, week);
  return completion;
}

starsRouter.get("/", async (req, res) => {
  const parsed = week.safeParse(req.query.week);
  if (!parsed.success) return res.status(400).json({ error: "Cette semaine n'est pas valable." });
  const familyId = req.userId!;
  const [members, completions, rewards, history, totals, requests, claims, goal] = await Promise.all([
    prisma.familyMember.findMany({ where: { userId: familyId }, orderBy: { order: "asc" } }),
    prisma.starCompletion.findMany({ where: { userId: familyId, week: parsed.data } }),
    prisma.reward.findMany({ where: { userId: familyId }, orderBy: { cost: "asc" } }),
    Promise.all([
      prisma.starCompletion.findMany({ where: { userId: familyId }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.rewardRedemption.findMany({ where: { userId: familyId }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]),
    balances(familyId),
    // Demandes en attente, et les 10 dernières réponses.
    Promise.all([
      prisma.rewardRequest.findMany({ where: { userId: familyId, status: "pending" }, orderBy: { createdAt: "asc" } }),
      prisma.rewardRequest.findMany({ where: { userId: familyId, status: { not: "pending" } }, orderBy: { decidedAt: "desc" }, take: 10 }),
    ]).then(([p, d]) => [...p, ...d]),
    // « J'ai fini » des ados : en attente, et celles de la semaine.
    prisma.starClaim.findMany({ where: { userId: familyId, OR: [{ status: "pending" }, { week: parsed.data }] }, include: { task: { select: { title: true, stars: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.familyGoal.findUnique({ where: { userId: familyId } }),
  ]);
  const children = members.filter((m) => isChild(m));
  const progress = goal ? await weekProgress(familyId, parsed.data) : 0;
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
    claims: claims.map((c) => ({ id: c.id, taskId: c.taskId, memberId: c.memberId, week: c.week, title: c.task.title, stars: c.task.stars, status: c.status, note: c.note, createdAt: c.createdAt.toISOString() })),
    goal: goal ? { title: goal.title, target: goal.target, progress, reached: progress >= goal.target } : null,
    seriesLevels: SERIES_LEVELS,
    requests: requests.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      rewardId: r.rewardId,
      title: r.title,
      cost: r.cost,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
    })),
  });
});

const completeSchema = z.object({ taskId: z.string(), memberId: z.string(), week });

starsRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const familyId = req.userId!;
  const task = await prisma.task.findFirst({ where: { id: d.taskId, userId: familyId }, include: { members: true } });
  if (!task) return res.status(404).json({ error: "Cette tâche n'existe plus. Elle a peut-être été supprimée." });
  if (!task.members.some((m) => m.memberId === d.memberId)) return res.status(400).json({ error: "Cette tâche n'est pas assignée à ce membre." });
  if (!(await childOf(familyId, d.memberId))) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans." });
  if (task.stars === 0) return res.status(400).json({ error: "Cette tâche ne rapporte pas d'étoile." });

  const completion = await complete(familyId, task, d.memberId, d.week);
  // Une demande de l'ado pour cette tâche est réglée du même coup.
  await prisma.starClaim.updateMany({ where: { userId: familyId, taskId: task.id, memberId: d.memberId, week: d.week, status: "pending" }, data: { status: "accepted", decidedAt: new Date() } });
  res.status(201).json({ completion: { taskId: completion.taskId, memberId: completion.memberId, stars: completion.stars } });
});

// Annuler une coche (erreur de l'adulte) : les étoiles sont retirées.
starsRouter.delete("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  await prisma.starCompletion.deleteMany({ where: { userId: req.userId, taskId: d.taskId, memberId: d.memberId, week: d.week } });
  await prisma.starClaim.deleteMany({ where: { userId: req.userId, taskId: d.taskId, memberId: d.memberId, week: d.week } });
  const task = await prisma.task.findFirst({ where: { id: d.taskId, userId: req.userId } });
  if (task) await syncSeriesBonus(req.userId!, task, d.memberId, d.week);
  res.status(204).end();
});

const rewardSchema = z.object({ title: z.string().trim().min(1).max(80), cost: z.number().int().min(1).max(1000) });

starsRouter.post("/rewards", async (req, res) => {
  const parsed = rewardSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const count = await prisma.reward.count({ where: { userId: req.userId } });
  if (count >= 30) return res.status(400).json({ error: "30 récompenses au plus. Supprimes-en une d'abord." });
  const reward = await prisma.reward.create({ data: { userId: req.userId!, ...parsed.data } });
  res.status(201).json({ reward: { id: reward.id, title: reward.title, cost: reward.cost } });
});

starsRouter.patch("/rewards/:id", async (req, res) => {
  const parsed = rewardSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await prisma.reward.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
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
  if (!reward) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  if (!(await childOf(familyId, parsed.data.memberId))) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans." });
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

// ---------------------------------------------------------------------------
// Demandes d'échange : un compte enfant demande une récompense quand il a
// assez d'étoiles ; les adultes sont prévenus et acceptent ou refusent.

const starsLabel = (n: number) => `${n} étoile${n > 1 ? "s" : ""}`;

/** Les comptes adultes de la famille (pas les enfants). */
async function adultAccounts(familyId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { OR: [{ id: familyId }, { familyOwnerId: familyId }], NOT: { familyRole: "child" } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

const notify = (accountIds: string[], body: string) => pushToAccounts(accountIds, body, "/stars").catch((e) => console.error("Reward request push failed:", e));

starsRouter.post("/rewards/:id/request", async (req, res) => {
  if (req.familyRole !== "child" || !req.childMemberId) return res.status(403).json({ error: "Seul l'enfant fait une demande ; un adulte peut échanger directement." });
  const familyId = req.userId!;
  const memberId = req.childMemberId;
  const reward = await prisma.reward.findFirst({ where: { id: req.params.id, userId: familyId } });
  if (!reward) return res.status(404).json({ error: "Cette récompense n'existe plus." });
  const member = await childOf(familyId, memberId);
  if (!member) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans." });
  const t = (await balances(familyId)).get(memberId) ?? { earned: 0, spent: 0 };
  const balance = t.earned - t.spent;
  if (balance < reward.cost) {
    return res.status(409).json({ error: `Il te manque ${starsLabel(reward.cost - balance)}.`, code: "not_enough_stars" });
  }
  const pending = await prisma.rewardRequest.findFirst({ where: { userId: familyId, memberId, rewardId: reward.id, status: "pending" } });
  if (pending) return res.status(409).json({ error: "Tu as déjà demandé cette récompense : ton parent va répondre.", code: "already_requested" });
  const request = await prisma.rewardRequest.create({ data: { userId: familyId, memberId, rewardId: reward.id, title: reward.title, cost: reward.cost } });
  await notify(await adultAccounts(familyId), `${member.name} demande : ${reward.title} (${starsLabel(reward.cost)}).`);
  res.status(201).json({ request: { id: request.id, status: request.status } });
});

async function pendingRequest(familyId: string, id: string) {
  return prisma.rewardRequest.findFirst({ where: { id, userId: familyId, status: "pending" }, include: { member: { select: { name: true } } } });
}

async function childAccountOf(memberId: string): Promise<string[]> {
  const child = await prisma.user.findUnique({ where: { childMemberId: memberId }, select: { id: true } });
  return child ? [child.id] : [];
}

starsRouter.post("/requests/:id/accept", async (req, res) => {
  const familyId = req.userId!;
  const request = await pendingRequest(familyId, req.params.id);
  if (!request) return res.status(404).json({ error: "Cette demande a déjà reçu une réponse." });
  const t = (await balances(familyId)).get(request.memberId) ?? { earned: 0, spent: 0 };
  const balance = t.earned - t.spent;
  if (balance < request.cost) {
    return res.status(409).json({ error: `Il manque maintenant ${starsLabel(request.cost - balance)} à ${request.member.name}.`, code: "not_enough_stars" });
  }
  await prisma.$transaction([
    prisma.rewardRedemption.create({ data: { userId: familyId, memberId: request.memberId, rewardId: request.rewardId, title: request.title, cost: request.cost } }),
    prisma.rewardRequest.update({ where: { id: request.id }, data: { status: "accepted", decidedAt: new Date() } }),
  ]);
  await notify(await childAccountOf(request.memberId), `Accepté : ${request.title} ! Bravo 🎉`);
  res.json({ balance: balance - request.cost });
});

starsRouter.post("/requests/:id/decline", async (req, res) => {
  const parsed = z.object({ note: z.string().trim().max(200).default("") }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  const request = await pendingRequest(familyId, req.params.id);
  if (!request) return res.status(404).json({ error: "Cette demande a déjà reçu une réponse." });
  await prisma.rewardRequest.update({ where: { id: request.id }, data: { status: "declined", note: parsed.data.note, decidedAt: new Date() } });
  await notify(await childAccountOf(request.memberId), `Pas cette fois pour ${request.title}${parsed.data.note ? ` : ${parsed.data.note}` : "."}`);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// « J'ai fini ! » : un ado (compte enfant) dit qu'il a fait une tâche ; un
// adulte valide (les étoiles sont comptées, bonus de série compris) ou refuse.

starsRouter.post("/claims", async (req, res) => {
  if (req.familyRole !== "child" || !req.childMemberId) return res.status(403).json({ error: "Un adulte coche directement « C'est fait » sur la tâche." });
  const parsed = z.object({ taskId: z.string(), week }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  const memberId = req.childMemberId;
  const task = await prisma.task.findFirst({ where: { id: parsed.data.taskId, userId: familyId }, include: { members: true } });
  if (!task) return res.status(404).json({ error: "Cette tâche n'existe plus." });
  if (!task.members.some((m) => m.memberId === memberId)) return res.status(400).json({ error: "Cette tâche n'est pas pour toi." });
  const member = await childOf(familyId, memberId);
  if (!member) return res.status(400).json({ error: "Les étoiles sont pour les enfants de moins de 15 ans." });
  if (task.stars === 0) return res.status(400).json({ error: "Cette tâche ne rapporte pas d'étoile." });
  if (await prisma.starCompletion.findFirst({ where: { taskId: task.id, memberId, week: parsed.data.week } })) return res.status(409).json({ error: "C'est déjà validé : tes étoiles sont comptées." });
  const existing = await prisma.starClaim.findUnique({ where: { taskId_memberId_week: { taskId: task.id, memberId, week: parsed.data.week } } });
  if (existing?.status === "pending") return res.status(409).json({ error: "C'est envoyé : ton parent va valider." });
  const claim = existing
    ? await prisma.starClaim.update({ where: { id: existing.id }, data: { status: "pending", note: "", decidedAt: null, createdAt: new Date() } })
    : await prisma.starClaim.create({ data: { userId: familyId, taskId: task.id, memberId, week: parsed.data.week } });
  await notify(await adultAccounts(familyId), `${member.name} a fini : ${task.title}. Tu valides ?`);
  res.status(201).json({ claim: { id: claim.id, status: claim.status } });
});

async function pendingClaim(familyId: string, id: string) {
  return prisma.starClaim.findFirst({ where: { id, userId: familyId, status: "pending" }, include: { task: true, member: { select: { name: true } } } });
}

starsRouter.post("/claims/:id/accept", async (req, res) => {
  const familyId = req.userId!;
  const claim = await pendingClaim(familyId, req.params.id);
  if (!claim) return res.status(404).json({ error: "Cette demande a déjà reçu une réponse." });
  await complete(familyId, claim.task, claim.memberId, claim.week);
  await prisma.starClaim.update({ where: { id: claim.id }, data: { status: "accepted", decidedAt: new Date() } });
  await notify(await childAccountOf(claim.memberId), `Validé : ${claim.task.title}. +${starsLabel(claim.task.stars)} ⭐`);
  res.status(204).end();
});

starsRouter.post("/claims/:id/decline", async (req, res) => {
  const parsed = z.object({ note: z.string().trim().max(200).default("") }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  const claim = await pendingClaim(familyId, req.params.id);
  if (!claim) return res.status(404).json({ error: "Cette demande a déjà reçu une réponse." });
  await prisma.starClaim.update({ where: { id: claim.id }, data: { status: "declined", note: parsed.data.note, decidedAt: new Date() } });
  await notify(await childAccountOf(claim.memberId), `Pas encore validé : ${claim.task.title}${parsed.data.note ? `. ${parsed.data.note}` : "."}`);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Objectif commun de la famille.

const goalSchema = z.object({ title: z.string().trim().min(1, "Donne un nom à l'objectif").max(80), target: z.number().int().min(1).max(500) });

starsRouter.put("/goal", async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.userId!;
  await prisma.familyGoal.upsert({ where: { userId: familyId }, create: { userId: familyId, ...parsed.data }, update: { ...parsed.data, reachedWeek: null } });
  res.status(204).end();
});

starsRouter.delete("/goal", async (req, res) => {
  await prisma.familyGoal.deleteMany({ where: { userId: req.userId } });
  res.status(204).end();
});
