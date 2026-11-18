import type { Learner } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { BADGE_LABELS } from "../lib/cervelle/badges";
import { addDays, beforeParisDay, mondayOf, parisDay } from "../lib/cervelle/days";

// The week's report for a parent (« Bilan de la semaine »): time spent,
// days worked, quiz results, notions mastered, what to review, interros
// coming up, badges won. Computed on demand: the parent's phone reminds them
// every Sunday evening (local notification), nothing is sent from here.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function weeklyReport(learner: Learner, monday: string) {
  const id = learner.id;
  const sunday = addDays(monday, 6);
  const prevMonday = addDays(monday, -7);
  const today = parisDay();
  const [sessions, prev, mastered, weak, exams, badges] = await Promise.all([
    prisma.studySession.findMany({ where: { learnerId: id, day: { gte: monday, lte: sunday } }, select: { day: true, seconds: true, mode: true, correct: true, total: true, label: true, revision: { select: { subject: true } } } }),
    prisma.studySession.aggregate({ where: { learnerId: id, day: { gte: prevMonday, lt: monday } }, _sum: { seconds: true } }),
    prisma.notion.findMany({
      where: { revision: { learnerId: id }, mastery: "mastered", children: { none: {} }, lastAnsweredAt: { gte: beforeParisDay(monday), lt: beforeParisDay(addDays(sunday, 2)) } },
      select: { lastAnsweredAt: true },
    }),
    prisma.notion.findMany({
      where: { revision: { learnerId: id, status: "ready" }, mastery: "review", children: { none: {} } },
      orderBy: { nextReviewAt: "asc" },
      take: 5,
      select: { title: true, revision: { select: { id: true, title: true, subject: true } } },
    }),
    prisma.revision.findMany({
      where: { learnerId: id, status: "ready", examDate: { gte: beforeParisDay(today), lt: beforeParisDay(addDays(today, 16)) } },
      orderBy: { examDate: "asc" },
      select: { id: true, title: true, subject: true, examDate: true, examBest: true, quizBest: true },
    }),
    prisma.learnerBadge.findMany({ where: { learnerId: id, earnedAt: { gte: beforeParisDay(monday), lt: beforeParisDay(addDays(sunday, 2)) } }, select: { key: true, earnedAt: true } }),
  ]);

  const inWeek = (d: Date | null) => !!d && parisDay(d) >= monday && parisDay(d) <= sunday;
  const scored = sessions.filter((s) => s.total > 0);
  const subjects = new Map<string, number>();
  for (const s of sessions) {
    const k = s.revision?.subject || (s.mode === "minuteur" ? "Minuteur" : "Révisions");
    subjects.set(k, (subjects.get(k) ?? 0) + s.seconds);
  }
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return { day, minutes: Math.round(sessions.filter((s) => s.day === day).reduce((n, s) => n + s.seconds, 0) / 60) };
  });

  return {
    name: learner.name,
    from: monday,
    to: sunday,
    minutes: Math.round(sessions.reduce((n, s) => n + s.seconds, 0) / 60),
    minutesBefore: Math.round((prev._sum.seconds ?? 0) / 60),
    activeDays: perDay.filter((d) => d.minutes > 0 || sessions.some((s) => s.day === d.day)).length,
    perDay,
    quizzes: scored.length,
    quizAverage: scored.length ? Math.round((scored.reduce((n, s) => n + s.correct / s.total, 0) / scored.length) * 100) : null,
    answers: scored.reduce((n, s) => n + s.total, 0),
    mastered: mastered.filter((n) => inWeek(n.lastAnsweredAt)).length,
    toReview: weak.map((n) => ({ title: n.title, revisionId: n.revision.id, revision: n.revision.title, subject: n.revision.subject })),
    exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subject, day: parisDay(e.examDate!), examBest: e.examBest === null ? null : Math.round(e.examBest / 5), quizBest: e.quizBest })),
    subjects: [...subjects.entries()].map(([subject, s]) => ({ subject, minutes: Math.round(s / 60) })).filter((x) => x.minutes > 0).sort((a, b) => b.minutes - a.minutes),
    badges: badges.filter((b) => inWeek(b.earnedAt)).map((b) => ({ key: b.key, label: BADGE_LABELS(b.key) })),
    streak: learner.streak,
  };
}

export function mountWeekly(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  router.get("/learners/:learnerId/weekly", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const asked = String(req.query.week ?? "");
    // Default: the week that ends this Sunday (or the one just ended, on Monday morning before any work).
    const monday = mondayOf(DAY.test(asked) ? asked : parisDay());
    res.json(await weeklyReport(learner, monday));
  });
}
