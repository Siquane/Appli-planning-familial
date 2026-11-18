import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { coinsFor, computeBadges, type BadgeStats } from "../lib/cervelle/badges";
import { parisDay } from "../lib/cervelle/days";
import { FOCUS_MIN_SECONDS } from "../lib/cervelle/game";

// Cervelle's badges: records, successes with three tiers, seasons and holidays.
// GET works out what the child has earned from what is already stored
// (sessions, revisions, notions), saves the new badges and pays their coins
// once. POST …/seen clears the red dots, only when the child looks.

export async function badgeStats(learner: Learner): Promise<{ stats: BadgeStats; studyDays: string[] }> {
  const id = learner.id;
  const [revisions, scored, mastered, focusSessions, answers, time, days] = await Promise.all([
    prisma.revision.findMany({ where: { learnerId: id, status: "ready" }, select: { id: true, subject: true, examDate: true } }),
    prisma.studySession.findMany({ where: { learnerId: id, mode: { in: ["qcm", "interro"] }, total: { gt: 0 } }, select: { mode: true, correct: true, total: true, day: true, revisionId: true } }),
    prisma.notion.count({ where: { revision: { learnerId: id }, mastery: "mastered", children: { none: {} } } }),
    prisma.studySession.count({ where: { learnerId: id, mode: "minuteur", seconds: { gte: FOCUS_MIN_SECONDS } } }),
    prisma.attempt.count({ where: { learnerId: id } }),
    prisma.studySession.aggregate({ where: { learnerId: id }, _sum: { seconds: true } }),
    prisma.studySession.groupBy({ by: ["day"], where: { learnerId: id } }),
  ]);

  const subjects = new Set(revisions.map((r) => r.subject.trim().toLowerCase()).filter(Boolean));
  const perfectQuizzes = scored.filter((s) => s.mode === "qcm" && s.correct === s.total).length;
  const bestInterro20 = Math.max(0, ...scored.filter((s) => s.mode === "interro").map((s) => Math.round((s.correct / s.total) * 20)));
  const preparedExams = revisions.filter((r) => {
    if (!r.examDate) return false;
    const examDay = parisDay(r.examDate);
    return scored.some((s) => s.mode === "interro" && s.revisionId === r.id && s.day < examDay);
  }).length;

  return {
    stats: {
      revisions: revisions.length,
      subjects: subjects.size,
      perfectQuizzes,
      mastered,
      bestInterro20,
      bestStreak: Math.max(learner.bestStreak, learner.streak),
      focusSessions,
      preparedExams,
      answers,
      minutes: Math.round((time._sum.seconds ?? 0) / 60),
    },
    studyDays: days.map((d) => d.day),
  };
}

/** Saves the badges not stored yet and pays them. Returns the keys actually added. */
async function award(learnerId: string, keys: string[]): Promise<{ added: string[]; coins: number }> {
  const stored = new Set((await prisma.learnerBadge.findMany({ where: { learnerId }, select: { key: true } })).map((b) => b.key));
  const added: string[] = [];
  let coins = 0;
  for (const key of keys.filter((k) => !stored.has(k))) {
    const pay = coinsFor(key);
    try {
      await prisma.$transaction([
        prisma.learnerBadge.create({ data: { learnerId, key, coins: pay } }),
        prisma.learner.update({ where: { id: learnerId }, data: { coins: { increment: pay } } }),
      ]);
      added.push(key);
      coins += pay;
    } catch (e) {
      // Another request saved it first: it is paid once, by that one.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return { added, coins };
}

export function mountBadges(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  router.get("/learners/:learnerId/badges", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const { stats, studyDays } = await badgeStats(learner);
    const view = computeBadges(stats, studyDays, parisDay());
    const { added, coins } = await award(learner.id, view.earnedKeys);
    const unseen = new Set((await prisma.learnerBadge.findMany({ where: { learnerId: learner.id, seenAt: null }, select: { key: true } })).map((b) => b.key));
    const isNew = (prefix: string) => [...unseen].some((k) => k === prefix || k.startsWith(`${prefix}:`));
    res.json({
      records: view.records,
      successes: view.successes.map((s) => ({ ...s, isNew: s.tier > 0 && isNew(s.id) })),
      windows: view.windows.map((w) => ({ ...w, isNew: w.earned && unseen.has(w.key) })),
      newCount: unseen.size,
      earnedCount: view.earnedKeys.length,
      coinsEarned: coins,
      added,
    });
  });

  router.post("/learners/:learnerId/badges/seen", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    // A parent looking doesn't clear the child's red dots.
    if (req.cervelle?.kind === "child") await prisma.learnerBadge.updateMany({ where: { learnerId: learner.id, seenAt: null }, data: { seenAt: new Date() } });
    res.status(204).end();
  });
}
