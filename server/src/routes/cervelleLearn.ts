import crypto from "node:crypto";
import type { Dictation, Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { addDays, beforeParisDay, mondayOf, parisDay } from "../lib/cervelle/days";
import { cleanWords, DICTATION_STARS, MAX_WORDS, missedWords, tokens, wordsToReview, type DictationSentence } from "../lib/cervelle/dictation";
import { isRight, LEVELS, levelForGrade, makeRun, MAX_LEVEL, MENTAL_STARS, nextLevel, LEVEL_UP_RUNS, LEVEL_UP_SCORE, RUN_SIZE } from "../lib/cervelle/mental";
import type { Level } from "../lib/cervelle/icons";
import { pushToAccounts } from "../lib/familyAlerts";
import * as ai from "../services/cervelleAi";
import type { fileSchema } from "./cervelle";
import { weeklyReport } from "./cervelleWeekly";

// Quatre façons d'apprendre autrement :
//   - la dictée : les mots de la semaine → des phrases lues à voix haute ;
//   - la carte mentale d'une leçon (faite une fois par l'IA, puis gardée) ;
//   - le calcul mental : des séries de 10 calculs, un niveau qui monte seul ;
//   - le journal de fierté du dimanche, envoyé aux parents et à partager.

export const PRIDE_STARS = 1;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Limited = "dictation" | "mindmap";
interface Deps {
  loadLearner: (req: Request, res: Response) => Promise<Learner | null>;
  parentOnly: (req: Request, res: Response, next: NextFunction) => void;
  aiConfigured: (res: Response) => boolean;
  decodeFiles: (files: z.infer<typeof fileSchema>[]) => ai.CourseFile[] | string;
  fileSchema: typeof fileSchema;
  underDailyLimit: (familyId: string, kind: Limited, res: Response) => Promise<boolean>;
  recordUsage: (familyId: string, kind: Limited, learnerId?: string) => Promise<{ id: string }>;
  withUsage: <T>(usageId: string, fn: () => Promise<T>) => Promise<T>;
}

/** Une étoile bonus, une seule fois par clé. Renvoie les étoiles gagnées (0 si déjà eues). */
async function bonus(learnerId: string, key: string, stars: number): Promise<number> {
  try {
    await prisma.starEvent.create({ data: { learnerId, key, day: parisDay(), stars } });
    return stars;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return 0;
    throw e;
  }
}

// ─── Dictée ──────────────────────────────────────────────────────────────

const sentencesOf = (d: Dictation) => d.sentences as unknown as DictationSentence[];

export function serializeDictation(d: Dictation) {
  const sentences = sentencesOf(d);
  return {
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    words: d.words,
    finished: !!d.finishedAt,
    toReview: wordsToReview(sentences),
    // Le texte est envoyé : le téléphone le lit à voix haute. L'appli ne le
    // montre qu'une fois la phrase écrite.
    sentences: sentences.map((s, index) => ({ index, text: s.text, typed: s.typed, missed: s.missed, words: tokens(s.text).length })),
  };
}

// ─── Calcul mental ───────────────────────────────────────────────────────

const levelOf = (l: Learner) => Math.min(MAX_LEVEL, Math.max(1, l.mentalLevel ?? levelForGrade(l.grade, l.level)));

async function mentalState(learner: Learner) {
  const level = levelOf(learner);
  const [recent, record] = await Promise.all([
    prisma.mentalRun.findMany({ where: { learnerId: learner.id, level }, orderBy: { createdAt: "desc" }, take: LEVEL_UP_RUNS, select: { correct: true, total: true } }),
    prisma.mentalRun.findFirst({ where: { learnerId: learner.id, level, correct: { gte: LEVEL_UP_SCORE } }, orderBy: { seconds: "asc" }, select: { seconds: true } }),
  ]);
  // Séries réussies d'affilée au niveau (vers le passage au suivant).
  let streak = 0;
  for (const r of recent) {
    if (r.total >= RUN_SIZE && r.correct >= LEVEL_UP_SCORE) streak++;
    else break;
  }
  return {
    level,
    label: LEVELS[level - 1].label,
    levels: LEVELS,
    tables: learner.mentalTables,
    record: record?.seconds ?? null,
    streak,
    toLevelUp: level >= MAX_LEVEL ? null : LEVEL_UP_RUNS,
    goal: LEVEL_UP_SCORE,
  };
}

// ─── Journal de fierté ───────────────────────────────────────────────────

export async function prideOf(learner: Learner, monday: string) {
  const sunday = addDays(monday, 6);
  const [report, journal, mastered, share] = await Promise.all([
    weeklyReport(learner, monday),
    prisma.journalEntry.findMany({ where: { learnerId: learner.id, day: { gte: monday, lte: sunday } }, orderBy: { day: "asc" } }),
    prisma.notion.findMany({
      where: { revision: { learnerId: learner.id }, children: { none: {} }, masteredAt: { gte: beforeParisDay(monday), lt: beforeParisDay(addDays(sunday, 1)) } },
      orderBy: { masteredAt: "asc" },
      take: 12,
      select: { title: true },
    }),
    prisma.prideShare.findUnique({ where: { learnerId_week: { learnerId: learner.id, week: monday } } }),
  ]);
  return {
    name: learner.name,
    week: monday,
    to: sunday,
    learned: journal.filter((j) => j.learned.trim()).map((j) => ({ day: j.day, text: j.learned.trim() })),
    proud: journal.filter((j) => j.proud.trim()).map((j) => ({ day: j.day, text: j.proud.trim() })),
    notions: mastered.map((n) => n.title),
    activeDays: report.activeDays,
    minutes: report.minutes,
    badges: report.badges.map((b) => b.label),
    message: share?.message ?? "",
    sent: !!share,
    sharePath: share ? `/f/${share.token}` : null,
    seen: !!share?.seenAt,
  };
}

const weekOf = (req: Request) => {
  const asked = String(req.query.week ?? "");
  return mondayOf(DAY.test(asked) ? asked : parisDay());
};

export function mountLearn(router: Router, d: Deps) {
  // ── Dictée ──
  router.get("/learners/:learnerId/dictations", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const list = await prisma.dictation.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 10 });
    res.json({ dictations: list.map(serializeDictation), stars: DICTATION_STARS });
  });

  router.post("/learners/:learnerId/dictations", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({ files: z.array(d.fileSchema).max(2, "2 photos au plus").default([]), words: z.array(z.string().max(400)).max(MAX_WORDS * 2).default([]) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const words = cleanWords(parsed.data.words);
    if (!parsed.data.files.length && words.length < 2) return res.status(400).json({ error: "Prends ta liste de mots en photo, ou écris au moins 2 mots." });
    const files = d.decodeFiles(parsed.data.files);
    if (typeof files === "string") return res.status(400).json({ error: files });
    if (!d.aiConfigured(res)) return;
    if (!(await d.underDailyLimit(learner.userId, "dictation", res))) return;
    const usage = await d.recordUsage(learner.userId, "dictation", learner.id);
    try {
      const out = await d.withUsage(usage.id, () => ai.writeDictation({ files, words, level: learner.level as Level, grade: learner.grade }));
      const sentences: DictationSentence[] = out.sentences.map((text) => ({ text, typed: null, missed: [] }));
      const created = await prisma.dictation.create({ data: { learnerId: learner.id, words: cleanWords(out.words.length ? out.words : words), sentences: sentences as object[] } });
      res.status(201).json({ dictation: serializeDictation(created) });
    } catch (e) {
      if (e instanceof ai.CervelleAiError) return res.status(422).json({ error: e.message });
      throw e;
    }
  });

  router.post("/learners/:learnerId/dictations/:dictationId/answer", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const dictation = await prisma.dictation.findFirst({ where: { id: String(req.params.dictationId), learnerId: learner.id } });
    if (!dictation) return res.status(404).json({ error: "Cette dictée n'existe plus." });
    const parsed = z.object({ index: z.number().int().min(0), typed: z.string().max(600) }).safeParse(req.body);
    const sentences = sentencesOf(dictation);
    const s = parsed.success ? sentences[parsed.data.index] : undefined;
    if (!parsed.success || !s) return res.status(400).json({ error: "Cette phrase n'existe pas." });
    s.typed = parsed.data.typed.trim();
    s.missed = missedWords(s.text, s.typed).map((m) => m.word);
    const done = sentences.every((x) => x.typed !== null);
    const updated = await prisma.dictation.update({
      where: { id: dictation.id },
      data: { sentences: sentences as object[], ...(done && !dictation.finishedAt ? { finishedAt: new Date() } : {}) },
    });
    // Les étoiles récompensent le travail : la dictée finie, quelles que soient les fautes.
    const stars = done ? await bonus(learner.id, `dictee:${dictation.id}`, DICTATION_STARS) : 0;
    res.json({ dictation: serializeDictation(updated), stars });
  });

  router.delete("/learners/:learnerId/dictations/:dictationId", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    await prisma.dictation.deleteMany({ where: { id: String(req.params.dictationId), learnerId: learner.id } });
    res.status(204).end();
  });

  // ── Carte mentale ──
  router.get("/learners/:learnerId/revisions/:revisionId/mindmap", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const revision = await prisma.revision.findFirst({ where: { id: String(req.params.revisionId), learnerId: learner.id, status: "ready" } });
    if (!revision) return res.status(404).json({ error: "Cette révision n'existe plus. Elle a peut-être été supprimée." });
    const leaves = await prisma.notion.findMany({ where: { revisionId: revision.id, children: { none: {} } }, select: { id: true, title: true, mastery: true } });
    const mastery = Object.fromEntries(leaves.map((n) => [n.id, n.mastery]));
    if (revision.mindMap) return res.json({ map: revision.mindMap, mastery });
    if (!leaves.length) return res.status(400).json({ error: "Cette leçon n'a pas encore de notions." });
    if (!d.aiConfigured(res)) return;
    if (!(await d.underDailyLimit(learner.userId, "mindmap", res))) return;
    const sheets = (Array.isArray(revision.sheets) ? revision.sheets : []) as { notionId?: string; essentiel?: string; points?: string[] }[];
    const notions = leaves.map((n) => {
      const sheet = sheets.find((s) => s.notionId === n.id);
      return { id: n.id, title: n.title, sheet: [sheet?.essentiel ?? "", ...(sheet?.points ?? [])].join("\n").slice(0, 1500) };
    });
    const usage = await d.recordUsage(learner.userId, "mindmap", learner.id);
    try {
      const map = await d.withUsage(usage.id, () => ai.makeMindMap({ title: revision.title || revision.subject, notions, level: learner.level as Level }));
      await prisma.revision.update({ where: { id: revision.id }, data: { mindMap: map as object } });
      res.json({ map, mastery });
    } catch (e) {
      if (e instanceof ai.CervelleAiError) return res.status(422).json({ error: e.message });
      throw e;
    }
  });

  // ── Calcul mental ──
  router.get("/learners/:learnerId/mental", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const state = await mentalState(learner);
    res.json({ ...state, problems: makeRun(state.level, learner.mentalTables), stars: MENTAL_STARS });
  });

  router.post("/learners/:learnerId/mental/runs", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({
        level: z.number().int().min(1).max(MAX_LEVEL),
        answers: z.array(z.object({ prompt: z.string().max(40), answer: z.number(), typed: z.string().max(20) })).min(1).max(RUN_SIZE),
        seconds: z.number().int().min(1).max(3600),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
    const before = await mentalState(learner);
    const correct = parsed.data.answers.filter((a) => isRight(a.typed, a.answer)).length;
    const total = parsed.data.answers.length;
    await prisma.mentalRun.create({ data: { learnerId: learner.id, day: parisDay(), level: parsed.data.level, correct, total, seconds: parsed.data.seconds } });
    let leveledUp = false;
    // Seule une série du niveau en cours fait monter.
    if (parsed.data.level === before.level) {
      const recent = await prisma.mentalRun.findMany({ where: { learnerId: learner.id, level: before.level }, orderBy: { createdAt: "desc" }, take: LEVEL_UP_RUNS, select: { correct: true, total: true } });
      const next = nextLevel(before.level, recent);
      if (next !== before.level) {
        await prisma.learner.update({ where: { id: learner.id }, data: { mentalLevel: next } });
        leveledUp = true;
      }
    }
    const newRecord = total >= RUN_SIZE && correct >= LEVEL_UP_SCORE && parsed.data.level === before.level && (before.record === null || parsed.data.seconds < before.record);
    const stars = await bonus(learner.id, `calcul:${parisDay()}`, MENTAL_STARS);
    const fresh = (await prisma.learner.findUnique({ where: { id: learner.id } }))!;
    res.json({ correct, total, leveledUp, newRecord, stars, state: await mentalState(fresh) });
  });

  /** Un parent choisit le niveau (null = d'après la classe) et les tables à travailler. */
  router.put("/learners/:learnerId/mental", d.parentOnly, async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({ level: z.number().int().min(1).max(MAX_LEVEL).nullable().optional(), tables: z.array(z.number().int().min(2).max(12)).max(11).optional() })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
    const updated = await prisma.learner.update({
      where: { id: learner.id },
      data: {
        ...(parsed.data.level !== undefined ? { mentalLevel: parsed.data.level } : {}),
        ...(parsed.data.tables ? { mentalTables: [...new Set(parsed.data.tables)].sort((a, b) => a - b) } : {}),
      },
    });
    res.json(await mentalState(updated));
  });

  // ── Journal de fierté ──
  router.get("/learners/:learnerId/pride", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    res.json({ pride: await prideOf(learner, weekOf(req)), stars: PRIDE_STARS });
  });

  /** L'enfant envoie sa page aux parents (et obtient le lien à partager). */
  router.post("/learners/:learnerId/pride", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z.object({ message: z.string().max(400).default("") }).safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: "Ton message est trop long." });
    const week = weekOf(req);
    const existing = await prisma.prideShare.findUnique({ where: { learnerId_week: { learnerId: learner.id, week } } });
    await prisma.prideShare.upsert({
      where: { learnerId_week: { learnerId: learner.id, week } },
      create: { learnerId: learner.id, week, message: parsed.data.message.trim(), token: crypto.randomBytes(18).toString("base64url") },
      update: { message: parsed.data.message.trim() },
    });
    if (!existing) {
      const accounts = await prisma.user.findMany({ where: { OR: [{ id: learner.userId }, { familyOwnerId: learner.userId }], NOT: { familyRole: "child" } }, select: { id: true } });
      pushToAccounts(
        accounts.map((a) => a.id),
        `${learner.name} t'envoie son journal de fierté de la semaine 🌟`,
        `/cervelle-fierte/${learner.id}?week=${week}`,
      ).catch((e) => console.error("Pride push failed:", e));
    }
    const stars = await bonus(learner.id, `fierte:${week}`, PRIDE_STARS);
    res.json({ pride: await prideOf(learner, week), stars });
  });

  /** Le parent a lu la page (Passerelle). */
  router.post("/learners/:learnerId/pride/seen", d.parentOnly, async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    await prisma.prideShare.updateMany({ where: { learnerId: learner.id, week: weekOf(req), seenAt: null }, data: { seenAt: new Date() } });
    res.status(204).end();
  });
}
