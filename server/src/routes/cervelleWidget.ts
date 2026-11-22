import type { Learner } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { parisDay } from "../lib/cervelle/days";
import { displayedMastery } from "../lib/cervelle/mastery";
import { PATH_END, starsOf } from "../lib/cervelle/stars";
import { monthFacts } from "./cervelleStars";

// What the Android home-screen widgets show, in one small read-only call:
// Cervelle and the streak, the next interro, today's missions and the
// month's stars, and a memory card of the day. Pays nothing (the app does).

interface Deps {
  loadLearner: (req: Request, res: Response) => Promise<Learner | null>;
  serializeLearner: (l: Learner) => { name: string; streak: number; equipped: string[] };
  missionState: (l: Learner) => Promise<{ done: number; total: number; chestOpened: boolean }>;
  revisionCards: (learnerId: string) => Promise<{ id: string; title: string; subject: string; status: string; examDate: string | null; progress: number; counts: { mastered: number; review: number; new: number } }[]>;
}

/** Same seed, same pick: the card stays the same all day. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export function mountWidget(router: Router, d: Deps) {
  router.get("/learners/:learnerId/widget", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const today = parisDay();
    const now = new Date();
    const [missions, revisions, facts, cards] = await Promise.all([
      d.missionState(learner),
      d.revisionCards(learner.id),
      monthFacts(learner, today.slice(0, 7)),
      prisma.question.findMany({
        where: { type: "carte", revision: { learnerId: learner.id, status: "ready" } },
        select: { id: true, prompt: true, answer: true, revisionId: true, revision: { select: { title: true } }, notion: { select: { mastery: true, nextReviewAt: true } } },
        take: 400,
      }),
    ]);

    const next = revisions
      .filter((r) => r.status === "ready" && r.examDate && r.examDate >= today)
      .sort((a, b) => a.examDate!.localeCompare(b.examDate!))[0];
    const total = next ? next.counts.mastered + next.counts.review + next.counts.new : 0;

    // Card of the day: one to review if there is any, else any card.
    const toReview = cards.filter((c) => displayedMastery(c.notion, now) === "review");
    const pool = (toReview.length ? toReview : cards).sort((a, b) => a.id.localeCompare(b.id));
    const card = pool.length ? pool[hash(`${learner.id}:${today}`) % pool.length] : null;

    const me = d.serializeLearner(learner);
    res.json({
      day: today,
      name: me.name,
      streak: me.streak,
      studiedToday: learner.lastStudyDay === today,
      equipped: me.equipped,
      missions: { done: missions.done, total: missions.total, chestOpened: missions.chestOpened },
      stars: { total: starsOf(facts).total, end: PATH_END },
      exam: next
        ? { revisionId: next.id, title: next.title, subject: next.subject, examDate: next.examDate, daysLeft: daysBetween(today, next.examDate!), mastered: next.counts.mastered, notions: total, progress: next.progress }
        : null,
      card: card ? { front: card.prompt, back: card.answer, revisionId: card.revisionId, title: card.revision.title } : null,
    });
  });
}
