import type { Learner } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";

// Quiz duels between friends. The challenger picks one of their ready
// revisions; 10 auto-graded questions (QCM, vrai/faux) are drawn from it and
// both friends answer the same ones, in any order, within a week. The best
// score wins DUEL_COINS (a draw: half each), paid once when the second one
// answers. Only friends both parents approved can duel.

export const DUEL_QUESTIONS = 10;
export const DUEL_COINS = 20;
const DUEL_DAYS = 7;

const answersSchema = z.object({ answers: z.array(z.object({ questionId: z.string().min(1).max(40), answer: z.string().max(10) })).max(DUEL_QUESTIONS) });

/** Approved friends, or brothers and sisters (same family account). */
async function areFriends(a: Learner, b: string) {
  if (a.id === b) return false;
  if (await prisma.learner.count({ where: { id: b, userId: a.userId } })) return true;
  return !!(await prisma.friendship.findFirst({ where: { fromApproved: true, toApproved: true, OR: [{ fromId: a.id, toId: b }, { fromId: b, toId: a.id }] } }));
}

/** Who won, from both scores: an id, "draw", or null while someone hasn't played. */
export function duelWinner(fromId: string, fromScore: number | null, toId: string, toScore: number | null): string | null {
  if (fromScore === null || toScore === null) return null;
  if (fromScore === toScore) return "draw";
  return fromScore > toScore ? fromId : toId;
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
  /** Challenge a friend on one of my courses. */
  router.post("/learners/:learnerId/duels", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const friendId = String(req.body?.friendId ?? "");
    const revisionId = String(req.body?.revisionId ?? "");
    if (!(await areFriends(learner, friendId))) return res.status(404).json({ error: "Ami introuvable" });
    const revision = await prisma.revision.findFirst({ where: { id: revisionId, learnerId: learner.id, status: "ready" }, select: { title: true } });
    if (!revision) return res.status(404).json({ error: "Révision introuvable" });
    const pool = await prisma.question.findMany({ where: { revisionId, type: { in: ["qcm", "vrai_faux"] } }, select: { id: true } });
    if (pool.length < 5) return res.status(400).json({ error: "Pas assez de questions dans ce cours pour un défi. Choisis-en un autre." });
    const open = await prisma.quizDuel.count({ where: { fromId: learner.id, toId: friendId, status: "open" } });
    if (open >= 3) return res.status(409).json({ error: "Tu as déjà 3 défis en cours avec cet ami. Attends qu'il réponde !" });
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
          result: x.status !== "done" ? null : x.winnerId === null ? "draw" : x.winnerId === learner.id ? "won" : "lost",
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
    if (!duel) return res.status(404).json({ error: "Défi introuvable" });
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
    if (!parsed.success) return res.status(400).json({ error: "Réponses invalides" });
    const duel = await prisma.quizDuel.findFirst({ where: { id: String(req.params.duelId), status: "open", OR: [{ fromId: learner.id }, { toId: learner.id }] } });
    if (!duel) return res.status(404).json({ error: "Défi introuvable ou terminé" });
    const mine = duel.fromId === learner.id;
    const qs = await prisma.question.findMany({ where: { id: { in: duel.questionIds } }, select: { id: true, answer: true } });
    const expected = new Map(qs.map((q) => [q.id, q.answer.trim().toLowerCase()]));
    const given = new Map(parsed.data.answers.map((a) => [a.questionId, a.answer.trim().toLowerCase()]));
    const score = duel.questionIds.filter((id) => expected.has(id) && given.get(id) === expected.get(id)).length;
    const corrections = duel.questionIds.map((id) => ({ questionId: id, correct: expected.has(id) && given.get(id) === expected.get(id), expected: expected.get(id) ?? "" }));

    // Conditional: a second tap can't overwrite the first score.
    const saved = await prisma.quizDuel.updateMany({ where: { id: duel.id, status: "open", ...(mine ? { fromScore: null } : { toScore: null }) }, data: mine ? { fromScore: score } : { toScore: score } });
    if (saved.count === 0) return res.status(409).json({ error: "Tu as déjà joué ce défi." });

    const after = await prisma.quizDuel.findUniqueOrThrow({ where: { id: duel.id } });
    const winner = duelWinner(after.fromId, after.fromScore, after.toId, after.toScore);
    let coins = 0;
    if (winner) {
      const ended = await prisma.quizDuel.updateMany({ where: { id: duel.id, status: "open" }, data: { status: "done", winnerId: winner === "draw" ? null : winner, endedAt: new Date() } });
      if (ended.count === 1) {
        if (winner === "draw") {
          await prisma.learner.updateMany({ where: { id: { in: [after.fromId, after.toId] } }, data: { coins: { increment: DUEL_COINS / 2 } } });
          coins = DUEL_COINS / 2;
        } else {
          await prisma.learner.update({ where: { id: winner }, data: { coins: { increment: DUEL_COINS } } });
          coins = winner === learner.id ? DUEL_COINS : 0;
        }
      }
    }
    const theirs = mine ? after.toScore : after.fromScore;
    res.json({ score, total: duel.questionIds.length, theirScore: theirs, result: winner === null ? null : winner === "draw" ? "draw" : winner === learner.id ? "won" : "lost", coins, corrections });
  });
}
