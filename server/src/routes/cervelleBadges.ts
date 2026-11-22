import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { BADGE_LABELS, coinsFor, computeBadges, type BadgeStats } from "../lib/cervelle/badges";
import { parisDay } from "../lib/cervelle/days";
import { FOCUS_MIN_SECONDS } from "../lib/cervelle/game";
import { equip, unlockedItems } from "../lib/cervelle/shop";

// Cervelle's badges: records, successes with three tiers, seasons and holidays.
// GET works out what the child has earned from what is already stored
// (sessions, revisions, notions), saves the new badges and pays their coins
// once. POST …/seen clears the red dots, only when the child looks.

export async function badgeStats(learner: Learner): Promise<{ stats: BadgeStats; studyDays: string[] }> {
  const id = learner.id;
  const [revisions, scored, mastered, focusSessions, answers, time, reviews, days] = await Promise.all([
    prisma.revision.findMany({ where: { learnerId: id, status: "ready" }, select: { id: true, subject: true, examDate: true } }),
    prisma.studySession.findMany({ where: { learnerId: id, mode: { in: ["qcm", "interro"] }, total: { gt: 0 } }, select: { mode: true, correct: true, total: true, day: true, revisionId: true } }),
    prisma.notion.count({ where: { revision: { learnerId: id }, mastery: "mastered", children: { none: {} } } }),
    prisma.studySession.count({ where: { learnerId: id, mode: "minuteur", seconds: { gte: FOCUS_MIN_SECONDS } } }),
    prisma.attempt.count({ where: { learnerId: id } }),
    prisma.studySession.aggregate({ where: { learnerId: id }, _sum: { seconds: true } }),
    prisma.studySession.count({ where: { learnerId: id, mode: "a_revoir", total: { gt: 0 } } }),
    prisma.studySession.groupBy({ by: ["day"], where: { learnerId: id } }),
  ]);

  const subjects = new Set(revisions.map((r) => r.subject.trim().toLowerCase()).filter(Boolean));
  // A QCM or interro done again on a course already practised in that mode.
  const seen = new Set<string>();
  let retakes = 0;
  for (const s of [...scored].sort((a, b) => a.day.localeCompare(b.day))) {
    const k = `${s.revisionId}:${s.mode}`;
    if (s.revisionId && seen.has(k)) retakes++;
    seen.add(k);
  }
  const preparedExams = revisions.filter((r) => {
    if (!r.examDate) return false;
    const examDay = parisDay(r.examDate);
    return scored.some((s) => s.mode === "interro" && s.revisionId === r.id && s.day < examDay);
  }).length;

  return {
    stats: {
      revisions: revisions.length,
      subjects: subjects.size,
      reviews,
      mastered,
      retakes,
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
  // An item a new badge unlocks is worn at once (it takes its slot's place).
  if (added.length) {
    const before = new Set(unlockedItems([...stored]).map((i) => i.id));
    const won = unlockedItems([...stored, ...added]).filter((i) => !before.has(i.id));
    if (won.length) {
      const learner = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId }, select: { equipped: true } });
      await prisma.learner.update({ where: { id: learnerId }, data: { equipped: won.reduce((eq, i) => equip(eq, i.id), learner.equipped) } });
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
    // Badges of the « chemin d'étoiles », earned at the end of a month's path.
    const paths = (await prisma.learnerBadge.findMany({ where: { learnerId: learner.id, key: { startsWith: "chemin:" } }, orderBy: { key: "desc" } })).map((b) => ({
      key: b.key,
      family: "chemin" as const,
      label: BADGE_LABELS(b.key),
      icon: "star",
      shape: "star" as const,
      earned: true,
      when: "past" as const,
      days: 1,
      needs: 1,
      from: `${b.key.slice(7)}-01`,
      to: `${b.key.slice(7)}-28`,
      hint: "Arriver au bout du chemin d'étoiles du mois.",
      coins: 0,
      isNew: !b.seenAt,
    }));
    const isNew = (prefix: string) => [...unseen].some((k) => k === prefix || k.startsWith(`${prefix}:`));
    res.json({
      records: view.records,
      successes: view.successes.map((s) => ({ ...s, isNew: s.tier > 0 && isNew(s.id) })),
      windows: [...paths, ...view.windows.map((w) => ({ ...w, isNew: w.earned && unseen.has(w.key) }))],
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
