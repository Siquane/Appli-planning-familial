import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { amountCents } from "./expenses";
import { addDays, parisDay } from "../lib/cervelle/days";
import { catchUpPocketMoney, nextPayDay, type Frequency } from "../lib/pocketMoney";

// Argent de poche d'un enfant. Lu par l'enfant lui-même, ou par un adulte de
// la famille dans « Espace de Jules » (en-tête X-Child-Space, qui met le
// compte de l'enfant dans req.privateId). Seul un adulte règle ou ajoute.
export const pocketMoneyRouter = Router();
pocketMoneyRouter.use(requireAuth);

/** Le compte enfant visé, ou null (réponse déjà envoyée). */
async function childAccount(req: Request, res: Response): Promise<string | null> {
  const account = await prisma.user.findUnique({ where: { id: req.privateId! }, select: { id: true, familyRole: true } });
  if (!account || account.familyRole !== "child") {
    res.status(404).json({ error: "L'argent de poche est pour les enfants qui ont leur accès.", code: "not_a_child" });
    return null;
  }
  return account.id;
}

/** Les avances des enfants : réservées aux parents (propriétaire ou accès complet), comme leur espace. */
function parentOnly(req: Request, res: Response): boolean {
  if (req.familyRole === "owner" || req.familyRole === "full") return true;
  res.status(403).json({ error: "Seul un parent avec l'accès complet peut voir les avances des enfants.", code: "child_space_forbidden" });
  return false;
}

function adultOnly(req: Request, res: Response): boolean {
  if (req.familyRole !== "child") return true;
  res.status(403).json({ error: "Demande à un parent de le faire.", code: "child_forbidden" });
  return false;
}

pocketMoneyRouter.get("/", async (req, res) => {
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  await catchUpPocketMoney(accountId);
  const [rule, credits, received, repaid, spent, advances] = await Promise.all([
    prisma.pocketMoneyRule.findUnique({ where: { accountId } }),
    prisma.pocketMoneyCredit.findMany({ where: { accountId }, orderBy: [{ day: "desc" }, { createdAt: "desc" }], take: 50 }),
    prisma.pocketMoneyCredit.aggregate({ where: { accountId, NOT: { source: "repay" } }, _sum: { amountCents: true } }),
    prisma.pocketMoneyCredit.aggregate({ where: { accountId, source: "repay" }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ where: { userId: accountId }, _sum: { amountCents: true } }),
    prisma.pocketMoneyAdvance.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const receivedCents = received._sum.amountCents ?? 0;
  // Remboursements d'avances : des versements négatifs.
  const repaidCents = -(repaid._sum.amountCents ?? 0);
  const spentCents = (spent._sum.amountCents ?? 0) + repaidCents;
  res.json({
    rule: rule
      ? { amountCents: rule.amountCents, frequency: rule.frequency, day: rule.day, nextDay: nextPayDay({ frequency: rule.frequency as Frequency, day: rule.day }, addDays(parisDay(), 1)) }
      : null,
    credits: credits.map((c) => ({ id: c.id, amountCents: c.amountCents, label: c.label, day: c.day, source: c.source })),
    receivedCents,
    spentCents,
    balanceCents: receivedCents - spentCents,
    advances: advances.map(serializeAdvance),
    owedCents: advances.reduce((n, a) => n + a.amountCents - a.repaidCents, 0),
  });
});

function serializeAdvance(a: { id: string; amountCents: number; label: string; day: string; repaidCents: number }) {
  return { id: a.id, amountCents: a.amountCents, label: a.label, day: a.day, repaidCents: a.repaidCents, leftCents: a.amountCents - a.repaidCents };
}

const ruleSchema = z
  .object({
    amountCents: amountCents.max(100_000, "100 € au plus par versement"),
    frequency: z.enum(["weekly", "monthly"]),
    day: z.number().int(),
  })
  .refine((r) => (r.frequency === "weekly" ? r.day >= 0 && r.day <= 6 : r.day >= 1 && r.day <= 28), "Jour invalide");

// Régler (ou changer) l'argent de poche : il commence demain, pour ne pas verser
// d'un coup les semaines passées.
pocketMoneyRouter.put("/rule", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  await catchUpPocketMoney(accountId); // ce qui était dû avec l'ancienne règle reste versé
  const startDay = addDays(parisDay(), 1);
  await prisma.pocketMoneyRule.upsert({
    where: { accountId },
    create: { accountId, ...parsed.data, startDay },
    update: { ...parsed.data, startDay },
  });
  res.status(204).end();
});

pocketMoneyRouter.delete("/rule", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  await catchUpPocketMoney(accountId);
  await prisma.pocketMoneyRule.deleteMany({ where: { accountId } });
  res.status(204).end();
});

// ── Avances : de l'argent avancé à l'enfant, qu'il rembourse quand il veut ──

const advanceSchema = z.object({
  amountCents: amountCents.max(100_000, "1 000 € au plus"),
  label: z.string().trim().min(1, "Dis ce que c'était").max(80),
});

/** Le compte enfant d'un membre de la famille, ou null. */
async function childOfMember(familyId: string, memberId: string) {
  return prisma.user.findFirst({ where: { familyOwnerId: familyId, familyRole: "child", childMemberId: memberId }, select: { id: true, name: true } });
}

/** Une nouvelle avance pour l'enfant de l'espace ouvert (Espace de Jules). */
pocketMoneyRouter.post("/advances", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const parsed = advanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  const a = await prisma.pocketMoneyAdvance.create({ data: { accountId, ...parsed.data, day: parisDay() } });
  res.status(201).json({ advance: serializeAdvance(a) });
});

pocketMoneyRouter.delete("/advances/:id", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  const { count } = await prisma.pocketMoneyAdvance.deleteMany({ where: { id: String(req.params.id), accountId } });
  if (count === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

/**
 * Rembourser (l'enfant lui-même, ou un parent) : pris dans sa cagnotte, tout
 * ce qui reste ou un montant choisi. Pas plus que ce qu'il y a dans la cagnotte.
 */
pocketMoneyRouter.post("/advances/:id/repay", async (req, res) => {
  const parsed = z.object({ amountCents: amountCents.optional() }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  await catchUpPocketMoney(accountId);
  const a = await prisma.pocketMoneyAdvance.findFirst({ where: { id: String(req.params.id), accountId } });
  if (!a) return res.status(404).json({ error: "Not found" });
  const left = a.amountCents - a.repaidCents;
  if (left <= 0) return res.status(409).json({ error: "C'est déjà remboursé." });
  const amount = Math.min(left, parsed.data.amountCents ?? left);
  // Solde vérifié et remboursement écrit d'un seul tenant, sous un verrou par
  // compte : deux remboursements en même temps ne vident pas la cagnotte.
  const done = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pocket:${accountId}`}))`;
    const [credits, spent] = await Promise.all([
      tx.pocketMoneyCredit.aggregate({ where: { accountId }, _sum: { amountCents: true } }),
      tx.expense.aggregate({ where: { userId: accountId }, _sum: { amountCents: true } }),
    ]);
    const balance = (credits._sum.amountCents ?? 0) - (spent._sum.amountCents ?? 0);
    if (balance < amount) return { short: balance };
    const upd = await tx.pocketMoneyAdvance.updateMany({ where: { id: a.id, repaidCents: a.repaidCents }, data: { repaidCents: { increment: amount } } });
    if (upd.count === 0) return false;
    await tx.pocketMoneyCredit.create({ data: { accountId, amountCents: -amount, label: `Remboursé : ${a.label}`, day: parisDay(), source: "repay" } });
    return true;
  });
  if (typeof done === "object") {
    const balance = done.short;
    return res.status(400).json({ error: balance > 0 ? `Il n'y a que ${(balance / 100).toFixed(2).replace(".", ",")} € dans la cagnotte : rembourse une partie.` : "La cagnotte est vide pour l'instant.", code: "not_enough" });
  }
  if (!done) return res.status(409).json({ error: "Réessaie dans un instant." });
  const updated = await prisma.pocketMoneyAdvance.findUniqueOrThrow({ where: { id: a.id } });
  res.json({ advance: serializeAdvance(updated) });
});

/** Onglet Comptes : les avances de tous les enfants de la famille. */
pocketMoneyRouter.get("/advances/family", async (req, res) => {
  if (!parentOnly(req, res)) return;
  const children = await prisma.user.findMany({ where: { familyOwnerId: req.familyId!, familyRole: "child" }, select: { id: true, name: true, childMemberId: true }, orderBy: { createdAt: "asc" } });
  const advances = await prisma.pocketMoneyAdvance.findMany({ where: { accountId: { in: children.map((c) => c.id) } }, orderBy: { createdAt: "desc" } });
  res.json({
    children: children.map((c) => {
      const mine = advances.filter((a) => a.accountId === c.id);
      return { memberId: c.childMemberId, name: c.name, owedCents: mine.reduce((n, a) => n + a.amountCents - a.repaidCents, 0), advances: mine.filter((a) => a.repaidCents < a.amountCents).map(serializeAdvance) };
    }),
  });
});

pocketMoneyRouter.post("/advances/family", async (req, res) => {
  if (!parentOnly(req, res)) return;
  const parsed = advanceSchema.extend({ memberId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const child = await childOfMember(req.familyId!, parsed.data.memberId);
  if (!child) return res.status(404).json({ error: "Cet enfant n'a pas encore son accès à Passerelle." });
  const a = await prisma.pocketMoneyAdvance.create({ data: { accountId: child.id, amountCents: parsed.data.amountCents, label: parsed.data.label, day: parisDay() } });
  res.status(201).json({ advance: serializeAdvance(a) });
});

const creditSchema = z.object({
  amountCents: amountCents.max(100_000, "100 € au plus par versement"),
  label: z.string().trim().min(1, "Un libellé est nécessaire").max(80),
});

// Versement ponctuel : anniversaire, récompense, petit job…
pocketMoneyRouter.post("/credits", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const parsed = creditSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  const credit = await prisma.pocketMoneyCredit.create({ data: { accountId, ...parsed.data, day: parisDay(), source: "manual" } });
  res.status(201).json({ credit: { id: credit.id, amountCents: credit.amountCents, label: credit.label, day: credit.day, source: credit.source } });
});

pocketMoneyRouter.delete("/credits/:id", async (req, res) => {
  if (!adultOnly(req, res)) return;
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  // Un remboursement d'avance ne se supprime pas ici (il fausserait l'avance).
  const { count } = await prisma.pocketMoneyCredit.deleteMany({ where: { id: String(req.params.id), accountId, NOT: { source: "repay" } } });
  if (count === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
