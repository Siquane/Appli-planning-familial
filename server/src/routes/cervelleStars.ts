import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { beforeParisDay, addDays, parisDay } from "../lib/cervelle/days";
import { onSale, SHOP, equip } from "../lib/cervelle/shop";
import { monthRange, openChest, PATH_END, starsOf, STAR_RULES, STEPS, themeOf, type MonthFacts } from "../lib/cervelle/stars";

// « Chemin d'étoiles »: GET works out the month's stars from what is stored,
// pays every reached step once (StarEvent « step:YYYY-MM:N »), and at the end
// gives the month's exclusive item and badge.

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function monthFacts(learner: Learner, month: string): Promise<MonthFacts> {
  const id = learner.id;
  const { from, to } = monthRange(month);
  const since = beforeParisDay(from);
  const until = beforeParisDay(addDays(to, 2));
  const [sessions, chests, duels, challenges, badges] = await Promise.all([
    prisma.studySession.findMany({ where: { learnerId: id, day: { gte: from, lte: to } }, select: { day: true, mode: true, correct: true, total: true } }),
    prisma.starEvent.count({ where: { learnerId: id, key: { startsWith: "chest:" }, day: { gte: from, lte: to } } }),
    prisma.quizDuel.findMany({ where: { progressIds: { has: id }, endedAt: { gte: since, lt: until } }, select: { endedAt: true } }),
    prisma.challenge.findMany({ where: { winnerId: id, week: { gte: addDays(from, -6), lte: to } }, select: { week: true } }),
    prisma.learnerBadge.findMany({ where: { learnerId: id, earnedAt: { gte: since, lt: until }, NOT: { key: { startsWith: "chemin:" } } }, select: { earnedAt: true } }),
  ]);
  const inMonth = (d: Date | null) => !!d && parisDay(d) >= from && parisDay(d) <= to;
  return {
    quizzes: sessions.filter((s) => ["qcm", "cartes", "a_revoir", "express"].includes(s.mode) && s.total > 0).map((s) => ({ mode: s.mode, total: s.total })),
    interros: sessions.filter((s) => s.mode === "interro" && s.total > 0).length,
    studyDays: sessions.map((s) => s.day),
    chests,
    // A weekly challenge counts in the month its week ends.
    wins: duels.filter((d) => inMonth(d.endedAt)).length + challenges.filter((c) => addDays(c.week, 6) >= from && addDays(c.week, 6) <= to).length,
    badges: badges.filter((b) => inMonth(b.earnedAt)).length,
  };
}

/** Pays one step (once). Returns what it gave, or null when it was paid before. */
async function payStep(learner: Learner, month: string, at: number, reward: (typeof STEPS)[number]["reward"]) {
  const key = `step:${month}:${at}`;
  let coins = 0;
  let item: string | null = null;
  if (reward.type === "coins") coins = reward.coins;
  else if (reward.type === "item") item = themeOf(month).item;
  else {
    const owned = new Set(learner.owned);
    const candidates = SHOP.filter((i) => i.kind === "normal" && i.price > 0 && i.price <= 120 && onSale(i, parisDay()) && !owned.has(i.id)).map((i) => i.id);
    ({ coins, item } = openChest(Math.random, candidates));
  }
  try {
    await prisma.$transaction([
      prisma.starEvent.create({ data: { learnerId: learner.id, key, day: parisDay(), coins, item } }),
      // A prize is worn at once (it takes its slot's place): the child sees it on Cervelle right away.
      prisma.learner.update({
        where: { id: learner.id },
        data: { coins: { increment: coins }, ...(item ? { equipped: equip(learner.equipped, item), ...(!learner.owned.includes(item) ? { owned: { push: item } } : {}) } : {}) },
      }),
      ...(reward.type === "item" ? [prisma.learnerBadge.upsert({ where: { learnerId_key: { learnerId: learner.id, key: `chemin:${month}` } }, create: { learnerId: learner.id, key: `chemin:${month}` }, update: {} })] : []),
    ]);
    if (item) {
      learner.owned.push(item);
      learner.equipped = equip(learner.equipped, item);
    }
    return { coins, item };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
    throw e;
  }
}

export function mountStars(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  router.get("/learners/:learnerId/stars", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const current = parisDay().slice(0, 7);
    const asked = String(req.query.month ?? "");
    const month = MONTH.test(asked) && asked <= current ? asked : current;
    const stars = starsOf(await monthFacts(learner, month));

    // Read what is already paid first: only the steps newly reached cost a write.
    const readPaid = async () => new Map((await prisma.starEvent.findMany({ where: { learnerId: learner.id, key: { startsWith: `step:${month}:` } } })).map((e) => [Number(e.key.split(":")[2]), e]));
    let paidSteps = await readPaid();
    const fresh: { at: number; coins: number; item: string | null }[] = [];
    for (const s of STEPS) {
      if (stars.total < s.at) break;
      if (s.reward.type === "none" || paidSteps.has(s.at)) continue;
      const paid = await payStep(learner, month, s.at, s.reward);
      if (paid) fresh.push({ at: s.at, ...paid });
    }
    if (fresh.length) paidSteps = await readPaid();
    const theme = themeOf(month);
    const itemName = (id: string | null) => (id ? (SHOP.find((i) => i.id === id)?.name ?? id) : null);
    res.json({
      month,
      theme: { id: theme.id, label: theme.label, item: theme.item, itemName: itemName(theme.item) },
      stars: stars.total,
      end: PATH_END,
      breakdown: { revision: stars.revision, regularite: stars.regularite, missions: stars.missions, defis: stars.defis },
      rules: STAR_RULES,
      steps: STEPS.map((s) => {
        const e = paidSteps.get(s.at);
        return { at: s.at, reward: s.reward, reached: stars.total >= s.at, result: e ? { coins: e.coins, item: e.item, itemName: itemName(e.item) } : null };
      }),
      fresh: fresh.map((f) => ({ ...f, itemName: itemName(f.item) })),
    });
  });
}
