import type { Learner, LearnerGoal } from "@prisma/client";
import type { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { addDays, mondayOf, parisDay } from "../lib/cervelle/days";
import { starsOf } from "../lib/cervelle/stars";
import { monthFacts } from "./cervelleStars";

// Goals a parent sets for a child, with a real family reward: « jours »
// (days of revision this week, Monday to Sunday) or « etoiles » (stars on
// this month's path). Progress is worked out from what is stored; when the
// target is reached the reward shows as won (no validation step), and the
// period is noted in `wins`.

export const MAX_GOALS = 3;
const goalSchema = z.object({
  kind: z.enum(["jours", "etoiles"]),
  target: z.number().int(),
  reward: z.string().trim().min(1).max(80),
});

const LIMITS = { jours: [1, 7], etoiles: [5, 50] } as const;

async function progress(learner: Learner, goal: LearnerGoal, today: string) {
  if (goal.kind === "jours") {
    const monday = mondayOf(today);
    const days = await prisma.studySession.groupBy({ by: ["day"], where: { learnerId: learner.id, day: { gte: monday, lte: addDays(monday, 6) } } });
    return { current: days.length, period: monday, label: "cette semaine", until: addDays(monday, 6) };
  }
  const month = today.slice(0, 7);
  const stars = starsOf(await monthFacts(learner, month));
  return { current: stars.total, period: month, label: "ce mois-ci", until: null };
}

export function mountGoals(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null>; parentOnly: (req: Request, res: Response, next: NextFunction) => unknown }) {
  router.get("/learners/:learnerId/goals", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const today = parisDay();
    const goals = await prisma.learnerGoal.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "asc" } });
    const out = [];
    for (const g of goals) {
      const p = await progress(learner, g, today);
      const reached = p.current >= g.target;
      if (reached && !g.wins.includes(p.period)) await prisma.learnerGoal.update({ where: { id: g.id }, data: { wins: { push: p.period } } });
      out.push({ id: g.id, kind: g.kind, target: g.target, reward: g.reward, current: Math.min(p.current, g.target), label: p.label, until: p.until, reached, wins: reached && !g.wins.includes(p.period) ? g.wins.length + 1 : g.wins.length });
    }
    res.json({ goals: out });
  });

  router.post("/learners/:learnerId/goals", d.parentOnly, async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Il manque quelque chose : choisis un type d'objectif, un nombre et une récompense." });
    const [min, max] = LIMITS[parsed.data.kind];
    if (parsed.data.target < min || parsed.data.target > max) return res.status(400).json({ error: `Choisis un nombre entre ${min} et ${max}.` });
    if ((await prisma.learnerGoal.count({ where: { learnerId: learner.id } })) >= MAX_GOALS) return res.status(409).json({ error: `${MAX_GOALS} objectifs au plus. Supprimes-en un d'abord.` });
    const goal = await prisma.learnerGoal.create({ data: { learnerId: learner.id, ...parsed.data } });
    res.status(201).json({ goal: { id: goal.id } });
  });

  router.delete("/learners/:learnerId/goals/:goalId", d.parentOnly, async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const removed = await prisma.learnerGoal.deleteMany({ where: { id: String(req.params.goalId), learnerId: learner.id } });
    if (removed.count === 0) return res.status(404).json({ error: "Cet objectif n'existe plus. Il a peut-être été supprimé." });
    res.status(204).end();
  });
}
