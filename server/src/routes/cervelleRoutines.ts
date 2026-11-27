import crypto from "node:crypto";
import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parisDay } from "../lib/cervelle/days";

// Routines du matin et du soir : une liste d'étapes illustrées (dents,
// cartable, pyjama…) qu'un parent règle dans Passerelle et que l'enfant coche
// dans Cervelle. Une routine finie dans la journée rapporte 1 étoile (une
// fois par routine et par jour : StarEvent « routine:<kind>:<jour> »).

export const ROUTINE_KINDS = ["matin", "soir"] as const;
type Kind = (typeof ROUTINE_KINDS)[number];
export const ROUTINE_STARS = 1;
const MAX_STEPS = 12;

type Step = { id: string; emoji: string; label: string };

/** Idées pour démarrer (l'appli Passerelle les propose). */
export const ROUTINE_IDEAS: Record<Kind, { emoji: string; label: string }[]> = {
  matin: [
    { emoji: "🛏️", label: "Faire mon lit" },
    { emoji: "🚿", label: "Me laver" },
    { emoji: "👕", label: "M'habiller" },
    { emoji: "🥣", label: "Petit-déjeuner" },
    { emoji: "🪥", label: "Me brosser les dents" },
    { emoji: "🎒", label: "Préparer mon cartable" },
    { emoji: "🧥", label: "Mettre mon manteau" },
  ],
  soir: [
    { emoji: "🧸", label: "Ranger ma chambre" },
    { emoji: "🎒", label: "Préparer mon cartable" },
    { emoji: "👖", label: "Préparer mes habits" },
    { emoji: "🛁", label: "Prendre ma douche" },
    { emoji: "🌙", label: "Mettre mon pyjama" },
    { emoji: "🪥", label: "Me brosser les dents" },
    { emoji: "📖", label: "Lire un peu" },
  ],
};

const stepsSchema = z.object({
  steps: z
    .array(z.object({ id: z.string().max(40).optional(), emoji: z.string().trim().min(1).max(8), label: z.string().trim().min(1).max(40) }))
    .max(MAX_STEPS),
});

const readSteps = (raw: unknown): Step[] => (Array.isArray(raw) ? (raw as Step[]).filter((s) => s && typeof s.id === "string") : []);

async function view(learner: Learner) {
  const today = parisDay();
  const [routines, checks, stars] = await Promise.all([
    prisma.routine.findMany({ where: { learnerId: learner.id } }),
    prisma.routineCheck.findMany({ where: { learnerId: learner.id, day: today } }),
    prisma.starEvent.findMany({ where: { learnerId: learner.id, key: { in: ROUTINE_KINDS.map((k) => `routine:${k}:${today}`) } }, select: { key: true } }),
  ]);
  return {
    today,
    stars: ROUTINE_STARS,
    ideas: ROUTINE_IDEAS,
    routines: ROUTINE_KINDS.map((kind) => {
      const steps = readSteps(routines.find((r) => r.kind === kind)?.steps);
      const checked = (checks.find((c) => c.kind === kind)?.stepIds ?? []).filter((id) => steps.some((s) => s.id === id));
      return { kind, steps, checked, done: steps.length > 0 && checked.length === steps.length, rewarded: stars.some((s) => s.key === `routine:${kind}:${today}`) };
    }),
  };
}

export function mountRoutines(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null>; parentOnly: (req: Request, res: Response, next: NextFunction) => unknown }) {
  router.get("/learners/:learnerId/routines", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    res.json(await view(learner));
  });

  router.put("/learners/:learnerId/routines/:kind", d.parentOnly, async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const kind = String(req.params.kind) as Kind;
    if (!ROUTINE_KINDS.includes(kind)) return res.status(404).json({ error: "Cette routine n'existe plus." });
    const parsed = stepsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: `${MAX_STEPS} étapes au plus, chacune avec un nom.` });
    const steps: Step[] = parsed.data.steps.map((s) => ({ id: s.id && /^[A-Za-z0-9_-]+$/.test(s.id) ? s.id : crypto.randomUUID().slice(0, 8), emoji: s.emoji, label: s.label }));
    await prisma.routine.upsert({ where: { learnerId_kind: { learnerId: learner.id, kind } }, create: { learnerId: learner.id, kind, steps }, update: { steps } });
    res.json(await view(learner));
  });

  router.post("/learners/:learnerId/routines/:kind/check", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const kind = String(req.params.kind) as Kind;
    if (!ROUTINE_KINDS.includes(kind)) return res.status(404).json({ error: "Cette routine n'existe plus." });
    const parsed = z.object({ stepId: z.string().max(40), on: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
    const routine = await prisma.routine.findUnique({ where: { learnerId_kind: { learnerId: learner.id, kind } } });
    const steps = readSteps(routine?.steps);
    if (!steps.some((s) => s.id === parsed.data.stepId)) return res.status(404).json({ error: "Cette étape n'existe plus." });
    const day = parisDay();
    const current = await prisma.routineCheck.findUnique({ where: { learnerId_kind_day: { learnerId: learner.id, kind, day } } });
    const ids = new Set(current?.stepIds ?? []);
    if (parsed.data.on) ids.add(parsed.data.stepId);
    else ids.delete(parsed.data.stepId);
    await prisma.routineCheck.upsert({ where: { learnerId_kind_day: { learnerId: learner.id, kind, day } }, create: { learnerId: learner.id, kind, day, stepIds: [...ids] }, update: { stepIds: [...ids] } });
    let earned = 0;
    if (steps.every((s) => ids.has(s.id))) {
      try {
        await prisma.starEvent.create({ data: { learnerId: learner.id, key: `routine:${kind}:${day}`, day, stars: ROUTINE_STARS } });
        earned = ROUTINE_STARS;
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      }
    }
    res.json({ ...(await view(learner)), earned });
  });
}
