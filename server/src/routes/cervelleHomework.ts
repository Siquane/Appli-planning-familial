import type { HomeworkHelp, Learner } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import type { Level } from "../lib/cervelle/icons";
import * as ai from "../services/cervelleAi";
import type { fileSchema } from "./cervelle";

// « Aide aux devoirs » : the child photographs an exercise; Cervelle reads its
// questions and, for each one, reveals hints one at a time (three at most)
// and checks the child's own answer. The answer itself is never shown.

export interface HomeworkQuestion {
  prompt: string;
  hints: string[];
  solution: string;
  hintsShown: number;
  attempts: number;
  solved: boolean;
  lastMessage: string;
}

const MAX_FILES = 3;
const questionsOf = (h: HomeworkHelp) => h.questions as unknown as HomeworkQuestion[];

/** What the child sees: no solution, only the hints already asked for. */
export function serializeHomework(h: HomeworkHelp) {
  const questions = questionsOf(h);
  return {
    id: h.id,
    subject: h.subject,
    instructions: h.instructions,
    createdAt: h.createdAt.toISOString(),
    solved: questions.filter((q) => q.solved).length,
    questions: questions.map((q, index) => ({
      index,
      prompt: q.prompt,
      hints: q.hints.slice(0, q.hintsShown),
      hintsLeft: Math.max(0, q.hints.length - q.hintsShown),
      attempts: q.attempts,
      solved: q.solved,
      lastMessage: q.lastMessage,
    })),
  };
}

type Limited = "homework";
export function mountHomework(
  router: Router,
  d: {
    loadLearner: (req: Request, res: Response) => Promise<Learner | null>;
    aiConfigured: (res: Response) => boolean;
    decodeFiles: (files: z.infer<typeof fileSchema>[]) => ai.CourseFile[] | string;
    fileSchema: typeof fileSchema;
    underDailyLimit: (familyId: string, kind: Limited, res: Response) => Promise<boolean>;
    recordUsage: (familyId: string, kind: Limited, learnerId?: string) => Promise<{ id: string }>;
    withUsage: <T>(usageId: string, fn: () => Promise<T>) => Promise<T>;
  },
) {
  const load = async (req: Request, res: Response) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return null;
    const help = await prisma.homeworkHelp.findFirst({ where: { id: String(req.params.homeworkId), learnerId: learner.id } });
    if (!help) {
      res.status(404).json({ error: "Cet exercice n'existe plus." });
      return null;
    }
    return { learner, help };
  };

  router.get("/learners/:learnerId/homework", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const list = await prisma.homeworkHelp.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 10 });
    res.json({ homework: list.map(serializeHomework) });
  });

  router.post("/learners/:learnerId/homework", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z.object({ files: z.array(d.fileSchema).min(1, "Prends l'exercice en photo").max(MAX_FILES, `${MAX_FILES} photos au plus`) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const files = d.decodeFiles(parsed.data.files);
    if (typeof files === "string") return res.status(400).json({ error: files });
    if (!d.aiConfigured(res)) return;
    if (!(await d.underDailyLimit(learner.userId, "homework", res))) return;
    const usage = await d.recordUsage(learner.userId, "homework", learner.id);
    try {
      const read = await d.withUsage(usage.id, () => ai.readHomework({ files, level: learner.level as Level, grade: learner.grade }));
      const questions: HomeworkQuestion[] = read.questions.map((q) => ({ prompt: q.enonce, hints: q.indices, solution: q.solution, hintsShown: 0, attempts: 0, solved: false, lastMessage: "" }));
      const help = await prisma.homeworkHelp.create({ data: { learnerId: learner.id, subject: read.matiere.trim().slice(0, 60), instructions: read.consigne.trim().slice(0, 600), questions: questions as object[] } });
      res.status(201).json({ homework: serializeHomework(help) });
    } catch (e) {
      if (e instanceof ai.CervelleAiError) return res.status(422).json({ error: e.message });
      throw e;
    }
  });

  router.get("/learners/:learnerId/homework/:homeworkId", async (req, res) => {
    const found = await load(req, res);
    if (found) res.json({ homework: serializeHomework(found.help) });
  });

  /** Reveals the next hint of one question. */
  router.post("/learners/:learnerId/homework/:homeworkId/hint", async (req, res) => {
    const found = await load(req, res);
    if (!found) return;
    const parsed = z.object({ index: z.number().int().min(0) }).safeParse(req.body);
    const questions = questionsOf(found.help);
    const q = parsed.success ? questions[parsed.data.index] : undefined;
    if (!q) return res.status(400).json({ error: "Cette question n'existe pas." });
    q.hintsShown = Math.min(q.hints.length, q.hintsShown + 1);
    const help = await prisma.homeworkHelp.update({ where: { id: found.help.id }, data: { questions: questions as object[] } });
    res.json({ homework: serializeHomework(help) });
  });

  /** Checks the child's answer to one question, without ever giving it away. */
  router.post("/learners/:learnerId/homework/:homeworkId/check", async (req, res) => {
    const found = await load(req, res);
    if (!found) return;
    const parsed = z.object({ index: z.number().int().min(0), answer: z.string().trim().min(1, "Écris ta réponse").max(800) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const questions = questionsOf(found.help);
    const q = questions[parsed.data.index];
    if (!q) return res.status(400).json({ error: "Cette question n'existe pas." });
    if (!d.aiConfigured(res)) return;
    if (!(await d.underDailyLimit(found.learner.userId, "homework", res))) return;
    const usage = await d.recordUsage(found.learner.userId, "homework", found.learner.id);
    try {
      const verdict = await d.withUsage(usage.id, () => ai.checkHomework({ question: q.prompt, solution: q.solution, answer: parsed.data.answer, level: found.learner.level as Level }));
      q.attempts += 1;
      q.solved ||= verdict.correct;
      q.lastMessage = verdict.message;
      const help = await prisma.homeworkHelp.update({ where: { id: found.help.id }, data: { questions: questions as object[] } });
      res.json({ correct: verdict.correct, message: verdict.message, homework: serializeHomework(help) });
    } catch (e) {
      if (e instanceof ai.CervelleAiError) return res.status(422).json({ error: e.message });
      throw e;
    }
  });
}
