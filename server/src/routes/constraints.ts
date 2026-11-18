import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";

export const constraintsRouter = Router();
constraintsRouter.use(requireAuth);

// Plages de la famille (sommeil, déjeuner, ne pas déranger) + horaires de
// travail du compte connecté (propres à chacun).
const workSelect = { workDays: true, workStart: true, workEnd: true } as const;
const workOf = (u: { workDays: number[]; workStart: string; workEnd: string } | null) => ({
  days: u?.workDays ?? [],
  start: u?.workStart ?? "09:00",
  end: u?.workEnd ?? "17:30",
});

constraintsRouter.get("/", async (req, res) => {
  const [constraints, account] = await Promise.all([
    prisma.constraints.upsert({
      where: { userId: req.userId! },
      update: {},
      create: { userId: req.userId! },
    }),
    prisma.user.findUnique({ where: { id: req.accountId ?? req.userId! }, select: workSelect }),
  ]);
  res.json({ constraints: { ...constraints, work: workOf(account) } });
});

const timeRe = /^\d{2}:\d{2}$/;
const patchSchema = z.object({
  sleepStart: z.string().regex(timeRe).optional(),
  sleepEnd: z.string().regex(timeRe).optional(),
  lunchStart: z.string().regex(timeRe).optional(),
  lunchEnd: z.string().regex(timeRe).optional(),
  dndStart: z.string().regex(timeRe).optional(),
  dndEnd: z.string().regex(timeRe).optional(),
  workDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  workStart: z.string().regex(timeRe).optional(),
  workEnd: z.string().regex(timeRe).optional(),
});

constraintsRouter.patch("/", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { workDays, workStart, workEnd, ...family } = parsed.data;
  const [constraints, account] = await Promise.all([
    prisma.constraints.upsert({
      where: { userId: req.userId! },
      update: family,
      create: { userId: req.userId!, ...family },
    }),
    prisma.user.update({
      where: { id: req.accountId ?? req.userId! },
      data: { workDays: workDays ? [...new Set(workDays)].sort((a, b) => a - b) : undefined, workStart, workEnd },
      select: workSelect,
    }),
  ]);
  res.json({ constraints: { ...constraints, work: workOf(account) } });
});
