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

function adultOnly(req: Request, res: Response): boolean {
  if (req.familyRole !== "child") return true;
  res.status(403).json({ error: "Demande à un parent de le faire.", code: "child_forbidden" });
  return false;
}

pocketMoneyRouter.get("/", async (req, res) => {
  const accountId = await childAccount(req, res);
  if (!accountId) return;
  await catchUpPocketMoney(accountId);
  const [rule, credits, received, spent] = await Promise.all([
    prisma.pocketMoneyRule.findUnique({ where: { accountId } }),
    prisma.pocketMoneyCredit.findMany({ where: { accountId }, orderBy: [{ day: "desc" }, { createdAt: "desc" }], take: 50 }),
    prisma.pocketMoneyCredit.aggregate({ where: { accountId }, _sum: { amountCents: true } }),
    prisma.expense.aggregate({ where: { userId: accountId }, _sum: { amountCents: true } }),
  ]);
  const receivedCents = received._sum.amountCents ?? 0;
  const spentCents = spent._sum.amountCents ?? 0;
  res.json({
    rule: rule
      ? { amountCents: rule.amountCents, frequency: rule.frequency, day: rule.day, nextDay: nextPayDay({ frequency: rule.frequency as Frequency, day: rule.day }, addDays(parisDay(), 1)) }
      : null,
    credits: credits.map((c) => ({ id: c.id, amountCents: c.amountCents, label: c.label, day: c.day, source: c.source })),
    receivedCents,
    spentCents,
    balanceCents: receivedCents - spentCents,
  });
});

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
  const { count } = await prisma.pocketMoneyCredit.deleteMany({ where: { id: String(req.params.id), accountId } });
  if (count === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
