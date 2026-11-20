import type { BrevetSubject, Learner, Revision } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parisDay, daysBetween } from "../lib/cervelle/days";
import { programmeFor } from "../lib/cervelle/programme";
import * as ai from "../services/cervelleAi";

// Mode Brevet : a countdown to the written exams and, per subject, mock
// papers built from the child's own revisions and the 3e programme. The child
// works on paper, then reveals the correction exercise by exercise.

/** Written exams of the 2027 session: 24, 25 and 28 June (BO spécial n° 2, 25 August 2026). */
export const BREVET_DATE = "2027-06-24";

export const BREVET_SUBJECTS = {
  francais: {
    label: "Français",
    match: /fran/i,
    programme: /fran/i,
    format: "épreuve de 3 h sur 100 points : compréhension et compétences d'interprétation sur un texte littéraire (avec parfois une image), grammaire et compétences linguistiques, dictée, puis rédaction (sujet d'imagination ou de réflexion).",
  },
  maths: {
    label: "Mathématiques",
    match: /math/i,
    programme: /math/i,
    format: "épreuve de 2 h sur 100 points : 5 à 7 exercices indépendants (nombres et calculs, géométrie, fonctions, statistiques et probabilités, algorithmique), dont un exercice de questions à choix multiples ; la démarche est notée.",
  },
  histoire: {
    label: "Histoire-géographie-EMC",
    match: /hist|g[ée]o|emc|moral/i,
    programme: /hist|g[ée]o|emc|moral/i,
    format: "épreuve de 2 h sur 50 points : analyse de documents en histoire ou en géographie, un développement construit, et un exercice d'enseignement moral et civique à partir d'une situation.",
  },
  sciences: {
    label: "Sciences",
    match: /svt|physique|chimie|techno|science|biolog/i,
    programme: /svt|physique|techno/i,
    format: "épreuve d'1 h sur 50 points : deux disciplines parmi physique-chimie, SVT et technologie (30 minutes chacune), à partir de documents, avec des questions de raisonnement scientifique.",
  },
} as const;
export type BrevetKey = keyof typeof BREVET_SUBJECTS;
const KEYS = Object.keys(BREVET_SUBJECTS) as BrevetKey[];

export interface BrevetExercise {
  title: string;
  points: number;
  documents: string;
  questions: { prompt: string; points: number; correction: string; advice: string }[];
}

export function serializeSujet(s: BrevetSubject) {
  return {
    id: s.id,
    subject: s.subject,
    label: BREVET_SUBJECTS[s.subject as BrevetKey]?.label ?? s.subject,
    status: s.status,
    error: s.error,
    title: s.title,
    minutes: s.minutes,
    createdAt: s.createdAt.toISOString(),
    exercises: s.exercises as unknown as BrevetExercise[],
  };
}

type Limited = "brevet";
export function mountBrevet(
  router: Router,
  d: {
    loadLearner: (req: Request, res: Response) => Promise<Learner | null>;
    aiConfigured: (res: Response) => boolean;
    underDailyLimit: (familyId: string, kind: Limited, res: Response) => Promise<boolean>;
    recordUsage: (familyId: string, kind: Limited, learnerId?: string) => Promise<{ id: string }>;
    withUsage: <T>(usageId: string, fn: () => Promise<T>) => Promise<T>;
    courseText: (r: Revision) => string;
  },
) {
  router.get("/learners/:learnerId/brevet", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const [revisions, sujets] = await Promise.all([
      prisma.revision.findMany({ where: { learnerId: learner.id, status: "ready" }, select: { subject: true } }),
      prisma.brevetSubject.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    const daysLeft = daysBetween(parisDay(), BREVET_DATE);
    res.json({
      date: BREVET_DATE,
      daysLeft: Math.max(0, daysLeft),
      subjects: KEYS.map((key) => ({ key, label: BREVET_SUBJECTS[key].label, revisions: revisions.filter((r) => BREVET_SUBJECTS[key].match.test(r.subject)).length })),
      sujets: sujets.map(serializeSujet),
    });
  });

  router.post("/learners/:learnerId/brevet/sujets", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const parsed = z.object({ subject: z.enum(KEYS as [BrevetKey, ...BrevetKey[]]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choisis une matière du Brevet." });
    if (!d.aiConfigured(res)) return;
    if (!(await d.underDailyLimit(learner.userId, "brevet", res))) return;
    const key = parsed.data.subject;
    const spec = BREVET_SUBJECTS[key];
    const sujet = await prisma.brevetSubject.create({ data: { learnerId: learner.id, subject: key, title: `Sujet type — ${spec.label}`, exercises: [] } });
    const usage = await d.recordUsage(learner.userId, "brevet", learner.id);
    void d.withUsage(usage.id, () => buildSujet(sujet.id, learner.id, key, d.courseText));
    res.status(202).json({ sujet: serializeSujet(sujet) });
  });

  router.get("/learners/:learnerId/brevet/sujets/:sujetId", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const sujet = await prisma.brevetSubject.findFirst({ where: { id: String(req.params.sujetId), learnerId: learner.id } });
    if (!sujet) return res.status(404).json({ error: "Ce sujet n'existe plus." });
    res.json({ sujet: serializeSujet(sujet) });
  });
}

/** Builds the paper in the background, from the child's revisions of that subject (newest first) and the 3e programme. */
export async function buildSujet(sujetId: string, learnerId: string, key: BrevetKey, courseText: (r: Revision) => string) {
  const spec = BREVET_SUBJECTS[key];
  try {
    const revisions = (await prisma.revision.findMany({ where: { learnerId, status: "ready" }, orderBy: { createdAt: "desc" }, take: 40 })).filter((r) => spec.match.test(r.subject)).slice(0, 8);
    const courses = revisions.map((r) => courseText(r).slice(0, 4000)).join("\n\n").slice(0, 24_000);
    const programme = (programmeFor("3e") ?? [])
      .filter((s) => spec.programme.test(s.subject))
      .map((s) => `${s.subject} :\n${s.chapters.map((c) => `- ${c.title} : ${c.notions.join(" ; ")}`).join("\n")}`)
      .join("\n\n");
    const out = await ai.generateBrevet({ subject: spec.label, format: spec.format, courses, programme });
    const exercises: BrevetExercise[] = out.exercices.slice(0, 7).map((e) => ({
      title: e.titre.trim().slice(0, 160),
      points: e.points,
      documents: e.documents.trim().slice(0, 4000),
      questions: e.questions.slice(0, 12).map((q) => ({ prompt: q.enonce.trim().slice(0, 1200), points: q.points, correction: q.corrige.trim().slice(0, 3000), advice: q.conseil.trim().slice(0, 400) })),
    }));
    await prisma.brevetSubject.update({ where: { id: sujetId }, data: { status: "ready", title: out.titre.trim().slice(0, 160) || `Sujet type — ${spec.label}`, minutes: out.duree_minutes, exercises: exercises as object[] } });
  } catch (e) {
    const message = e instanceof ai.CervelleAiError ? e.message : "Le sujet n'a pas pu être préparé. Réessaie.";
    await prisma.brevetSubject.update({ where: { id: sujetId }, data: { status: "failed", error: message } }).catch(() => {});
  }
}
