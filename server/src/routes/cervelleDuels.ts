import type { Learner } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

// Quiz duels between friends. The challenger picks one of their ready
// revisions; 10 auto-graded questions (QCM, vrai/faux) are drawn from it and
// both friends answer the same ones, in any order, within a week. Learning
// and work before marks: each one earns DUEL_FINISH_COINS for playing it
// through, and when both have played, DUEL_PROGRESS_COINS go to whoever did
// better than in their own previous duel (both, if they progressed as much).
// Nobody « wins » on the score. Only friends both parents approved can duel.

export const DUEL_QUESTIONS = 10;
export const DUEL_FINISH_COINS = 10;
export const DUEL_PROGRESS_COINS = 10;
const DUEL_DAYS = 7;

const answersSchema = z.object({ answers: z.array(z.object({ questionId: z.string().min(1).max(40), answer: z.string().max(10) })).max(DUEL_QUESTIONS) });

/** Approved friends, or brothers and sisters (same family account). */
async function areFriends(a: Learner, b: string) {
  if (a.id === b) return false;
  if (await prisma.learner.count({ where: { id: b, userId: a.userId } })) return true;
  return !!(await prisma.friendship.findFirst({ where: { fromApproved: true, toApproved: true, OR: [{ fromId: a.id, toId: b }, { fromId: b, toId: a.id }] } }));
}

/**
 * Who progressed most, from each one's gain on their own previous duel (in
 * points out of 100; null without a previous duel). Returns the ids that get
 * the progress bonus: none if nobody progressed.
 */
export function mostProgress(a: { id: string; gain: number | null }, b: { id: string; gain: number | null }): string[] {
  const ga = a.gain ?? 0;
  const gb = b.gain ?? 0;
  const best = Math.max(ga, gb);
  if (best <= 0) return [];
  return [a, b].filter((p) => (p.gain ?? 0) === best).map((p) => p.id);
}

/** A learner's score (out of 100) in their last finished duel before this one, or null. */
async function previousScore(learnerId: string, excludeId: string): Promise<number | null> {
  const last = await prisma.quizDuel.findFirst({ where: { id: { not: excludeId }, status: "done", OR: [{ fromId: learnerId }, { toId: learnerId }] }, orderBy: { endedAt: "desc" } });
  if (!last || !last.questionIds.length) return null;
  const score = last.fromId === learnerId ? last.fromScore : last.toScore;
  return score === null ? null : (score / last.questionIds.length) * 100;
}

const shuffle = <T,>(a: T[]) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function mountDuels(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  /**
   * « Révision à deux » on one phone: 12 QCM / vrai-faux questions of one of
   * my courses, WITH their answers (the phone checks them, turn by turn).
   * Nothing is recorded: the other player's answers must not change my progress.
   */
  router.get("/learners/:learnerId/revisions/:revisionId/duo", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const revision = await prisma.revision.findFirst({ where: { id: String(req.params.revisionId), learnerId: learner.id, status: "ready" }, select: { title: true } });
    if (!revision) return res.status(404).json({ error: "Cette révision n'existe plus. Elle a peut-être été supprimée." });
    const pool = await prisma.question.findMany({ where: { revisionId: String(req.params.revisionId), type: { in: ["qcm", "vrai_faux"] } }, select: { id: true, type: true, prompt: true, choices: true, answer: true, explanation: true } });
    if (pool.length < 4) return res.status(400).json({ error: "Pas assez de questions dans ce cours. Choisis-en un autre." });
    res.json({ title: revision.title, questions: shuffle(pool).slice(0, 12) });
  });

  /** Challenge a friend on one of my courses. */
  router.post("/learners/:learnerId/duels", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const friendId = String(req.body?.friendId ?? "");
    const revisionId = String(req.body?.revisionId ?? "");
    if (!(await areFriends(learner, friendId))) return res.status(404).json({ error: "Cet ami n'est plus dans ta liste." });
    const revision = await prisma.revision.findFirst({ where: { id: revisionId, learnerId: learner.id, status: "ready" }, select: { title: true } });
    if (!revision) return res.status(404).json({ error: "Cette révision n'existe plus. Elle a peut-être été supprimée." });
    const pool = await prisma.question.findMany({ where: { revisionId, type: { in: ["qcm", "vrai_faux"] } }, select: { id: true } });
    if (pool.length < 5) return res.status(400).json({ error: "Pas assez de questions dans ce cours pour un défi. Choisis-en un autre." });
    const open = await prisma.quizDuel.count({ where: { fromId: learner.id, toId: friendId, status: "open" } });
    if (open >= 3) return res.status(409).json({ error: "Tu as déjà 3 défis en cours avec cet ami. Attends sa réponse !" });
    const duel = await prisma.quizDuel.create({
      data: { fromId: learner.id, toId: friendId, revisionTitle: revision.title || "Quiz", questionIds: shuffle(pool.map((q) => q.id)).slice(0, DUEL_QUESTIONS) },
    });
    res.status(201).json({ duel: { id: duel.id } });
  });

  /** My duels: to play, waiting for the friend, finished (last 20). */
  router.get("/learners/:learnerId/duels", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    // Duels nobody finished within a week end without a winner.
    await prisma.quizDuel.updateMany({ where: { status: "open", createdAt: { lt: new Date(Date.now() - DUEL_DAYS * 86_400_000) }, OR: [{ fromId: learner.id }, { toId: learner.id }] }, data: { status: "expired", endedAt: new Date() } });
    const duels = await prisma.quizDuel.findMany({
      where: { OR: [{ fromId: learner.id }, { toId: learner.id }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { from: { select: { name: true, color: true, equipped: true } }, to: { select: { name: true, color: true, equipped: true } } },
    });
    res.json({
      duels: duels.map((x) => {
        const mine = x.fromId === learner.id;
        const myScore = mine ? x.fromScore : x.toScore;
        const theirScore = mine ? x.toScore : x.fromScore;
        const friend = mine ? x.to : x.from;
        return {
          id: x.id,
          title: x.revisionTitle,
          friend: { name: friend.name, color: friend.color, equipped: friend.equipped },
          sentByMe: mine,
          status: x.status,
          myScore,
          // Their score stays hidden until I've played, so I can't aim for it.
          theirScore: myScore === null ? null : theirScore,
          theyPlayed: theirScore !== null,
          // « progress »: I got the progress bonus; « finished »: done, no bonus for me.
          result: x.status !== "done" ? null : x.progressIds.includes(learner.id) ? "progress" : "finished",
          total: x.questionIds.length,
          createdAt: x.createdAt.toISOString(),
        };
      }),
    });
  });

  /** The questions, without their answers, for a duel I haven't played. */
  router.get("/learners/:learnerId/duels/:duelId", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const duel = await prisma.quizDuel.findFirst({ where: { id: String(req.params.duelId), OR: [{ fromId: learner.id }, { toId: learner.id }] } });
    if (!duel) return res.status(404).json({ error: "Ce défi n'existe plus." });
    const played = (duel.fromId === learner.id ? duel.fromScore : duel.toScore) !== null;
    if (played || duel.status !== "open") return res.status(409).json({ error: "Tu as déjà joué ce défi." });
    const qs = await prisma.question.findMany({ where: { id: { in: duel.questionIds } }, select: { id: true, type: true, prompt: true, choices: true } });
    const byId = new Map(qs.map((q) => [q.id, q]));
    res.json({ id: duel.id, title: duel.revisionTitle, questions: duel.questionIds.map((id) => byId.get(id)).filter(Boolean) });
  });

  /** My answers, all at once. Scores the duel, and pays the winner when both have played. */
  router.post("/learners/:learnerId/duels/:duelId/answers", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = answersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Il manque des réponses. Réponds à toutes les questions puis réessaie." });
    const duel = await prisma.quizDuel.findFirst({ where: { id: String(req.params.duelId), status: "open", OR: [{ fromId: learner.id }, { toId: learner.id }] } });
    if (!duel) return res.status(404).json({ error: "Ce défi est déjà terminé." });
    const mine = duel.fromId === learner.id;
    const qs = await prisma.question.findMany({ where: { id: { in: duel.questionIds } }, select: { id: true, answer: true } });
    const expected = new Map(qs.map((q) => [q.id, q.answer.trim().toLowerCase()]));
    const given = new Map(parsed.data.answers.map((a) => [a.questionId, a.answer.trim().toLowerCase()]));
    const score = duel.questionIds.filter((id) => expected.has(id) && given.get(id) === expected.get(id)).length;
    const corrections = duel.questionIds.map((id) => ({ questionId: id, correct: expected.has(id) && given.get(id) === expected.get(id), expected: expected.get(id) ?? "" }));

    // Conditional: a second tap can't overwrite the first score.
    const saved = await prisma.quizDuel.updateMany({ where: { id: duel.id, status: "open", ...(mine ? { fromScore: null } : { toScore: null }) }, data: mine ? { fromScore: score } : { toScore: score } });
    if (saved.count === 0) return res.status(409).json({ error: "Tu as déjà joué ce défi." });

    // Playing it through is what counts: paid now, once (the update above is conditional).
    await prisma.learner.update({ where: { id: learner.id }, data: { coins: { increment: DUEL_FINISH_COINS } } });
    let coins = DUEL_FINISH_COINS;

    const after = await prisma.quizDuel.findUniqueOrThrow({ where: { id: duel.id } });
    let progressIds: string[] = [];
    if (after.fromScore !== null && after.toScore !== null) {
      const n = after.questionIds.length;
      const gain = async (id: string, score: number) => {
        const prev = await previousScore(id, after.id);
        return prev === null ? null : (score / n) * 100 - prev;
      };
      progressIds = mostProgress({ id: after.fromId, gain: await gain(after.fromId, after.fromScore) }, { id: after.toId, gain: await gain(after.toId, after.toScore) });
      const ended = await prisma.quizDuel.updateMany({ where: { id: duel.id, status: "open" }, data: { status: "done", progressIds, winnerId: progressIds.length === 1 ? progressIds[0] : null, endedAt: new Date() } });
      if (ended.count === 1 && progressIds.length) {
        await prisma.learner.updateMany({ where: { id: { in: progressIds } }, data: { coins: { increment: DUEL_PROGRESS_COINS } } });
        if (progressIds.includes(learner.id)) coins += DUEL_PROGRESS_COINS;
      }
    }
    const theirs = mine ? after.toScore : after.fromScore;
    const done = after.fromScore !== null && after.toScore !== null;
    res.json({ score, total: duel.questionIds.length, theirScore: theirs, result: !done ? null : progressIds.includes(learner.id) ? "progress" : "finished", coins, corrections });
  });
}
