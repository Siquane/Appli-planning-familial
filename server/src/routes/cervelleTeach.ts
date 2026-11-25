import crypto from "node:crypto";
import type { Learner, Question, TeachQuiz } from "@prisma/client";
import type { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parisDay } from "../lib/cervelle/days";
import { CERVELLE_CHANNEL } from "../lib/cervelle/push";
import { pushToAccounts, sendPush } from "../lib/familyAlerts";

// « Apprends-le à papa/maman » : l'enfant choisit une révision, Cervelle prend
// 5 questions à choix (QCM, vrai ou faux) et les envoie à la famille dans
// Passerelle. Un parent y répond ; l'enfant voit ses réponses (et peut lui
// expliquer ses erreurs) et gagne des étoiles pour avoir enseigné — quel que
// soit le score du parent. Expliquer aux autres, c'est la meilleure façon de
// retenir.

export const TEACH_QUESTIONS = 5;
export const TEACH_STARS = 3;
/** Quiz envoyés pas encore répondus, au plus. */
const MAX_PENDING = 5;

const teachSchema = z.object({ revisionId: z.string().min(1) });
const answersSchema = z.object({ answers: z.array(z.string().max(10)).min(1).max(TEACH_QUESTIONS) });

type Graded = { questionId: string; answer: string; correct: boolean };

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Une question avec la réponse du parent et la bonne réponse (après coup). */
function questionView(q: Question, graded: Graded | null, withAnswer: boolean) {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    choices: q.type === "qcm" ? q.choices : ["Vrai", "Faux"],
    ...(withAnswer
      ? {
          expected: q.type === "qcm" ? Number(q.answer) : q.answer === "vrai" ? 0 : 1,
          explanation: q.explanation,
          given: graded ? (q.type === "qcm" ? Number(graded.answer) : graded.answer === "vrai" ? 0 : 1) : null,
          correct: graded?.correct ?? null,
        }
      : {}),
  };
}

async function view(t: TeachQuiz, withAnswers: boolean) {
  const [questions, revision, learner] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: t.questionIds } } }),
    prisma.revision.findUnique({ where: { id: t.revisionId }, select: { title: true, subject: true } }),
    prisma.learner.findUnique({ where: { id: t.learnerId }, select: { name: true } }),
  ]);
  const graded = (Array.isArray(t.answers) ? (t.answers as Graded[]) : []) ?? [];
  const ordered = t.questionIds.map((id) => questions.find((q) => q.id === id)).filter((q): q is Question => !!q);
  return {
    id: t.id,
    learnerName: learner?.name ?? "",
    revisionTitle: revision?.title || revision?.subject || "Une leçon",
    createdAt: t.createdAt.toISOString(),
    answered: !!t.answeredAt,
    answeredByName: t.answeredByName,
    answeredAt: t.answeredAt?.toISOString() ?? null,
    score: t.answeredAt ? graded.filter((g) => g.correct).length : null,
    total: ordered.length,
    seen: !!t.seenAt,
    questions: ordered.map((q) => questionView(q, graded.find((g) => g.questionId === q.id) ?? null, withAnswers && !!t.answeredAt)),
  };
}

/** Les comptes parents de la famille (pas les comptes enfants de Passerelle). */
async function parentAccounts(familyId: string) {
  return prisma.user.findMany({ where: { OR: [{ id: familyId }, { familyOwnerId: familyId }], NOT: { familyRole: "child" } }, select: { id: true } });
}

export function mountTeach(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null>; parentOnly: (req: Request, res: Response, next: NextFunction) => unknown }) {
  // ── Côté enfant (Cervelle) ──
  router.post("/learners/:learnerId/teach", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = teachSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
    const revision = await prisma.revision.findFirst({ where: { id: parsed.data.revisionId, learnerId: learner.id, status: "ready" } });
    if (!revision) return res.status(404).json({ error: "Cette révision n'existe plus. Elle a peut-être été supprimée." });
    const pending = await prisma.teachQuiz.count({ where: { learnerId: learner.id, answeredAt: null } });
    if (pending >= MAX_PENDING) return res.status(400).json({ error: `Tu as déjà ${MAX_PENDING} quiz qui attendent une réponse. Attends que tes parents y répondent !` });
    const questions = await prisma.question.findMany({ where: { revisionId: revision.id, type: { in: ["qcm", "vrai_faux"] } }, select: { id: true, notionId: true } });
    // Une question par notion d'abord, pour couvrir toute la leçon.
    const byNotion = new Map<string, string[]>();
    for (const q of shuffle(questions)) byNotion.set(q.notionId, [...(byNotion.get(q.notionId) ?? []), q.id]);
    const picked: string[] = [];
    const groups = [...byNotion.values()];
    while (picked.length < TEACH_QUESTIONS && groups.some((g) => g.length)) {
      for (const g of groups) {
        const id = g.shift();
        if (id) picked.push(id);
        if (picked.length === TEACH_QUESTIONS) break;
      }
    }
    if (picked.length < 3) return res.status(400).json({ error: "Pas assez de questions à choix dans cette leçon pour faire un quiz." });
    const quiz = await prisma.teachQuiz.create({ data: { learnerId: learner.id, revisionId: revision.id, questionIds: picked } });
    const accounts = await parentAccounts(learner.userId);
    const what = revision.title.trim() ? ` sur « ${revision.title.trim()} »` : "";
    pushToAccounts(
      accounts.map((a) => a.id),
      `${learner.name} t'a préparé un quiz${what} 🧠 Sauras-tu répondre ?`,
      `/cervelle-quiz/${quiz.id}`,
    ).catch((e) => console.error("Teach push failed:", e));
    res.status(201).json({ quiz: await view(quiz, true) });
  });

  router.get("/learners/:learnerId/teach", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const list = await prisma.teachQuiz.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 20 });
    const quizzes = await Promise.all(list.map((t) => view(t, true)));
    res.json({ quizzes, unseen: quizzes.filter((q) => q.answered && !q.seen).length, stars: TEACH_STARS });
  });

  router.post("/learners/:learnerId/teach/seen", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    await prisma.teachQuiz.updateMany({ where: { learnerId: learner.id, answeredAt: { not: null }, seenAt: null }, data: { seenAt: new Date() } });
    res.status(204).end();
  });

  // ── Côté parent (Passerelle) ──
  router.get("/teach/pending", d.parentOnly, async (req, res) => {
    const list = await prisma.teachQuiz.findMany({
      where: { answeredAt: null, learner: { userId: req.cervelle!.familyId } },
      orderBy: { createdAt: "desc" },
      include: { learner: { select: { name: true } }, revision: { select: { title: true, subject: true } } },
      take: 10,
    });
    res.json({ quizzes: list.map((t) => ({ id: t.id, learnerName: t.learner.name, revisionTitle: t.revision.title || t.revision.subject || "Une leçon", createdAt: t.createdAt.toISOString() })) });
  });

  async function loadQuiz(req: Request, res: Response) {
    const quiz = await prisma.teachQuiz.findFirst({ where: { id: String(req.params.id), learner: { userId: req.cervelle!.familyId } } });
    if (!quiz) res.status(404).json({ error: "Ce quiz n'existe plus." });
    return quiz;
  }

  router.get("/teach/:id", d.parentOnly, async (req, res) => {
    const quiz = await loadQuiz(req, res);
    if (!quiz) return;
    res.json({ quiz: await view(quiz, true) });
  });

  router.post("/teach/:id/answers", d.parentOnly, async (req, res) => {
    const quiz = await loadQuiz(req, res);
    if (!quiz) return;
    if (quiz.answeredAt) return res.status(409).json({ error: `${quiz.answeredByName ?? "Quelqu'un"} a déjà répondu à ce quiz.` });
    const parsed = answersSchema.safeParse(req.body);
    if (!parsed.success || parsed.data.answers.length !== quiz.questionIds.length) return res.status(400).json({ error: "Réponds à toutes les questions." });
    const questions = await prisma.question.findMany({ where: { id: { in: quiz.questionIds } } });
    // Réponses envoyées comme l'index du choix (0, 1, …) ; vrai ou faux : 0 = vrai, 1 = faux.
    const graded: Graded[] = quiz.questionIds.map((id, i) => {
      const q = questions.find((x) => x.id === id);
      const raw = parsed.data.answers[i];
      if (!q) return { questionId: id, answer: raw, correct: false };
      const answer = q.type === "vrai_faux" ? (raw === "0" ? "vrai" : "faux") : raw;
      return { questionId: id, answer, correct: answer === q.answer };
    });
    const accountId = req.cervelle!.kind === "parent" ? req.cervelle!.accountId : undefined;
    const who = accountId ? await prisma.user.findUnique({ where: { id: accountId }, select: { name: true } }) : null;
    const firstName = who?.name.trim().split(/\s+/)[0] || "Ton parent";
    // Conditionnel : deux parents qui répondent en même temps, un seul compte.
    const done = await prisma.teachQuiz.updateMany({
      where: { id: quiz.id, answeredAt: null },
      data: { answers: graded, answeredAt: new Date(), answeredById: accountId ?? null, answeredByName: firstName },
    });
    if (done.count === 0) return res.status(409).json({ error: "Quelqu'un a déjà répondu à ce quiz." });
    // Les étoiles récompensent l'enfant d'avoir enseigné, pas le score du parent.
    await prisma.starEvent
      .create({ data: { learnerId: quiz.learnerId, key: `apprends:${quiz.id}`, day: parisDay(), stars: TEACH_STARS } })
      .catch(() => undefined);
    const score = graded.filter((g) => g.correct).length;
    const devices = await prisma.learnerDevice.findMany({ where: { learnerId: quiz.learnerId, pushToken: { not: null } }, select: { pushToken: true } });
    sendPush(
      devices.map((x) => ({
        to: x.pushToken!,
        title: "Cervelle",
        body: `${firstName} a répondu à ton quiz : ${score}/${graded.length}. ${score < graded.length ? "Va lui expliquer ses erreurs !" : "Tu lui as bien appris !"}`,
        data: { url: "/apprends" },
        channelId: CERVELLE_CHANNEL,
        sound: "default" as const,
      })),
    ).catch((e) => console.error("Teach push to child failed:", e));
    res.json({ quiz: await view((await prisma.teachQuiz.findUnique({ where: { id: quiz.id } }))!, true) });
  });
}
