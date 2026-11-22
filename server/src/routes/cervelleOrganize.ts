import crypto from "node:crypto";
import type { NextFunction, Request, Response, Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import type { Learner, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { dateForWeekday } from "../lib/dates";
import { addDays, mondayOf, parisDay, weekdayOf } from "../lib/cervelle/days";
import {
  CHALLENGE_COINS,
  CHEERS,
  FOCUS_MIN_SECONDS,
  HABIT_COINS,
  HABIT_XP,
  TODO_COINS,
  TODO_DAILY_CAP,
  TODO_XP,
  challengeWinner,
  cheerById,
  currentStreak,
  focusReward,
  levelOf,
  makeFriendCode,
  nextStreak,
} from "../lib/cervelle/game";
import * as ai from "../services/cervelleAi";

// Cervelle, the « s'organiser » side, inspired by what students ask for:
// a timer, an agenda (timetable read from a photo), a to-do list sorted by
// urgent / important, daily habits, a journal, progress charts, and friends.
//
// Friends are children of other families: a parent of EACH child must say
// yes before they see each other, and they only ever share a first name,
// a mascot, a level and minutes worked. No free text between children:
// only ready-made encouragements and week-long challenges.
//
// The agenda stays separate from Passerelle's family planning; a parent can
// synchronise both ways on demand (POST …/agenda/sync).

type FileInput = { data: string; mimeType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf" };
type Limited = "timetable";

export interface OrganizeDeps {
  loadLearner: (req: Request, res: Response) => Promise<Learner | null>;
  parentOnly: (req: Request, res: Response, next: NextFunction) => unknown;
  serializeLearner: (l: Learner) => unknown;
  missionState: (l: Learner) => Promise<unknown>;
  underDailyLimit: (familyId: string, kind: Limited, res: Response) => Promise<boolean>;
  recordUsage: (familyId: string, kind: Limited, learnerId?: string) => Promise<{ id: string }>;
  withUsage: <T>(usageId: string, fn: () => Promise<T>) => Promise<T>;
  aiConfigured: (res: Response) => boolean;
  decodeFiles: (files: FileInput[]) => ai.CourseFile[] | string;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FRIENDS = 30;
const CHEERS_PER_DAY = 30;

const by = (req: Request) => (req.cervelle!.kind === "parent" ? "parent" : "enfant");
const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const friendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.DISABLE_RATE_LIMIT === "1",
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Trop d'essais. Réessaie dans 15 minutes." },
});

/** Gives coins and xp, never below zero when taking back. Returns the learner after. */
async function grant(learnerId: string, coins: number, xp: number) {
  if (coins >= 0 && xp >= 0) {
    return prisma.learner.update({ where: { id: learnerId }, data: { coins: { increment: coins }, xp: { increment: xp } } });
  }
  const l = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } });
  return prisma.learner.update({ where: { id: learnerId }, data: { coins: Math.max(0, l.coins + coins), xp: Math.max(0, l.xp + xp) } });
}

const levelUpOf = (before: Learner, after: Learner) => (levelOf(after.xp).level > levelOf(before.xp).level ? levelOf(after.xp) : null);

/** Siblings (same family) and friends whose link both parents approved. */
async function circleOf(learner: Learner) {
  const [siblings, links] = await Promise.all([
    prisma.learner.findMany({ where: { userId: learner.userId, id: { not: learner.id } } }),
    prisma.friendship.findMany({
      where: { fromApproved: true, toApproved: true, OR: [{ fromId: learner.id }, { toId: learner.id }] },
      include: { from: true, to: true },
    }),
  ]);
  const friends = links.map((f) => ({ friendshipId: f.id, learner: f.fromId === learner.id ? f.to : f.from }));
  return { siblings, friends };
}

async function inCircle(learner: Learner, otherId: string) {
  const { siblings, friends } = await circleOf(learner);
  return siblings.some((s) => s.id === otherId) || friends.some((f) => f.learner.id === otherId);
}

/** Minutes worked by each learner between two days (« from » included, « to » excluded). */
async function minutesBetween(ids: string[], from: string, to: string) {
  if (!ids.length) return new Map<string, number>();
  const rows = await prisma.studySession.groupBy({ by: ["learnerId"], where: { learnerId: { in: ids }, day: { gte: from, lt: to } }, _sum: { seconds: true } });
  return new Map(rows.map((r) => [r.learnerId, Math.floor((r._sum.seconds ?? 0) / 60)]));
}

/** Ends last weeks' challenges: the winner gets the coins (once, thanks to the conditional update). */
async function settleChallenges(learnerId: string, thisMonday: string) {
  await prisma.challenge.updateMany({ where: { status: "pending", week: { lt: thisMonday }, OR: [{ fromId: learnerId }, { toId: learnerId }] }, data: { status: "declined" } });
  const ended = await prisma.challenge.findMany({ where: { status: "active", week: { lt: thisMonday }, OR: [{ fromId: learnerId }, { toId: learnerId }] } });
  for (const c of ended) {
    const mins = await minutesBetween([c.fromId, c.toId], c.week, addDays(c.week, 7));
    const fromMinutes = mins.get(c.fromId) ?? 0;
    const toMinutes = mins.get(c.toId) ?? 0;
    const winner = challengeWinner(c.fromId, fromMinutes, c.toId, toMinutes);
    const done = await prisma.challenge.updateMany({
      where: { id: c.id, status: "active" },
      data: { status: "done", winnerId: winner, fromMinutes, toMinutes },
    });
    if (done.count === 0) continue;
    if (winner === "tie") {
      await prisma.learner.updateMany({ where: { id: { in: [c.fromId, c.toId] } }, data: { coins: { increment: CHALLENGE_COINS / 2 } } });
    } else if (winner) {
      await prisma.learner.update({ where: { id: winner }, data: { coins: { increment: CHALLENGE_COINS } } });
    }
  }
}

async function ensureFriendCode(learner: Learner): Promise<string> {
  if (learner.friendCode) return learner.friendCode;
  for (let i = 0; i < 5; i++) {
    const code = makeFriendCode((n) => crypto.randomInt(n));
    const done = await prisma.learner.updateMany({ where: { id: learner.id, friendCode: null }, data: { friendCode: code } }).catch(() => null);
    if (done) {
      const after = await prisma.learner.findUniqueOrThrow({ where: { id: learner.id } });
      if (after.friendCode) return after.friendCode;
    }
  }
  throw new Error("Could not create a friend code");
}

const publicLearner = (l: Learner) => ({ id: l.id, name: l.name, color: l.color, equipped: l.equipped, level: levelOf(l.xp).level });

// ─── Schemas ─────────────────────────────────────────────────────────────

// « activite » is shown as « Loisirs »; maison, sante and travail are Passerelle's other task categories.
const EVENT_KINDS = ["cours", "interro", "devoir", "revision", "activite", "maison", "sante", "travail"] as const;
type EventKind = (typeof EVENT_KINDS)[number];

/** Passerelle task category of a Cervelle slot (school work is « École »). */
export function categoryOfKind(kind: string): string {
  return { activite: "Loisirs", maison: "Maison", sante: "Santé", travail: "Travail" }[kind] ?? "École";
}

/** Cervelle kind of a Passerelle task, from its category. */
export function kindOfCategory(category: string): EventKind {
  return ({ Loisirs: "activite", Maison: "maison", Santé: "sante", Travail: "travail", École: "cours" } as Record<string, EventKind>)[category] ?? "activite";
}

const eventBase = z.object({
  title: z.string().trim().min(1, "Donne un nom").max(60),
  kind: z.enum(EVENT_KINDS).default("cours"),
  weekday: z.number().int().min(0).max(6).nullable().default(null),
  day: z.string().regex(DAY).nullable().default(null),
  start: z.string().regex(HHMM, "Heure de début invalide"),
  end: z.string().regex(HHMM, "Heure de fin invalide"),
  room: z.string().trim().max(30).default(""),
});

const eventSchema = eventBase
  .refine((e) => (e.weekday === null) !== (e.day === null), "Choisis un jour de la semaine ou une date.")
  .refine((e) => e.start < e.end, "La fin doit être après le début.");

const todoSchema = z.object({
  title: z.string().trim().min(1, "Écris ta tâche").max(80),
  urgent: z.boolean().default(false),
  important: z.boolean().default(true),
  dueDay: z.string().regex(DAY).nullable().default(null),
});

const HABIT_COLORS = ["violet", "corail", "menthe", "soleil", "ciel", "framboise"] as const;
const habitSchema = z.object({
  title: z.string().trim().min(1, "Donne un nom").max(40),
  emoji: z.string().trim().min(1).max(8).default("⭐"),
  color: z.enum(HABIT_COLORS).default("ciel"),
  days: z.array(z.number().int().min(0).max(6)).min(1, "Choisis au moins un jour").max(7).default([0, 1, 2, 3, 4, 5, 6]),
});

const journalSchema = z.object({
  mood: z.number().int().min(1).max(5),
  learned: z.string().trim().max(500).default(""),
  proud: z.string().trim().max(500).default(""),
  hard: z.string().trim().max(500).default(""),
});

const serializeEvent = (e: Prisma.StudyEventGetPayload<object>) => ({
  id: e.id,
  title: e.title,
  kind: e.kind,
  weekday: e.weekday,
  day: e.day,
  start: e.start,
  end: e.end,
  room: e.room,
  createdBy: e.createdBy,
  source: e.source,
  synced: !!e.passerelleTaskId,
  category: e.source === "passerelle" ? (e.passerelleCategory ?? null) : null,
});

const serializeTodo = (t: Prisma.TodoItemGetPayload<object>) => ({
  id: t.id,
  title: t.title,
  urgent: t.urgent,
  important: t.important,
  dueDay: t.dueDay,
  done: !!t.doneAt,
  doneAt: t.doneAt?.toISOString() ?? null,
  createdBy: t.createdBy,
  createdAt: t.createdAt.toISOString(),
});

// ─── Routes ──────────────────────────────────────────────────────────────

export function mountOrganize(router: Router, d: OrganizeDeps) {
  const { loadLearner, parentOnly, serializeLearner, missionState } = d;

  // ── Timer & study profile ──

  router.patch("/learners/:learnerId/timer", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = z.object({ focus: z.number().int().min(5).max(90), pause: z.number().int().min(1).max(30) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choisis entre 5 et 90 minutes de travail, et entre 1 et 30 minutes de pause." });
    const updated = await prisma.learner.update({ where: { id: learner.id }, data: { focusMinutes: parsed.data.focus, breakMinutes: parsed.data.pause } });
    res.json({ learner: serializeLearner(updated) });
  });

  router.put("/learners/:learnerId/study-profile", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({
        profile: z.string().trim().min(1).max(40),
        scores: z.record(z.string().max(30), z.number().min(0).max(100)),
        methods: z.array(z.string().max(40)).max(12),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
    const updated = await prisma.learner.update({ where: { id: learner.id }, data: { studyProfile: { ...parsed.data, at: new Date().toISOString() } } });
    res.json({ learner: serializeLearner(updated) });
  });

  /** End of a timer session: time, coins, xp, streak. */
  router.post("/learners/:learnerId/focus", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({
        seconds: z.number().int().min(1).max(4 * 3600),
        label: z.string().trim().max(80).default(""),
        revisionId: z.string().nullable().optional(),
        todoId: z.string().nullable().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const b = parsed.data;
    const revision = b.revisionId ? await prisma.revision.findFirst({ where: { id: b.revisionId, learnerId: learner.id } }) : null;
    if (b.revisionId && !revision) return res.status(404).json({ error: "Cette révision n'existe plus. Elle a peut-être été supprimée." });
    const todo = b.todoId ? await prisma.todoItem.findFirst({ where: { id: b.todoId, learnerId: learner.id } }) : null;
    if (b.todoId && !todo) return res.status(404).json({ error: "Cette tâche n'existe plus. Elle a peut-être été supprimée." });

    const today = parisDay();
    const already = await prisma.studySession.aggregate({ where: { learnerId: learner.id, day: today, mode: "minuteur" }, _sum: { seconds: true } });
    const reward = focusReward(b.seconds, Math.floor((already._sum.seconds ?? 0) / 60));
    const counts = b.seconds >= FOCUS_MIN_SECONDS;
    const streak = counts ? nextStreak(learner.lastStudyDay, learner.streak, today) : learner.streak;

    const [, updated] = await prisma.$transaction([
      prisma.studySession.create({
        data: { learnerId: learner.id, revisionId: revision?.id ?? null, mode: "minuteur", label: b.label || todo?.title || "", seconds: b.seconds, coins: reward.coins, day: today },
      }),
      prisma.learner.update({
        where: { id: learner.id },
        data: {
          coins: { increment: reward.coins },
          xp: { increment: reward.xp },
          ...(counts ? { streak, bestStreak: Math.max(learner.bestStreak, streak), lastStudyDay: today } : {}),
        },
      }),
    ]);
    res.status(201).json({
      coins: reward.coins,
      xp: reward.xp,
      counted: counts,
      learner: serializeLearner(updated),
      streakIncreased: counts && streak > currentStreak(learner.lastStudyDay, learner.streak, today),
      levelUp: levelUpOf(learner, updated),
      missions: await missionState(updated),
    });
  });

  // ── Statistics ──

  router.get("/learners/:learnerId/stats", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const today = parisDay();
    const from = addDays(today, -83);
    const since30 = addDays(today, -29);
    const [perDay, all, recent, todosDone, habitChecks, journalDays, mastered] = await Promise.all([
      prisma.studySession.groupBy({ by: ["day"], where: { learnerId: learner.id, day: { gte: from } }, _sum: { seconds: true } }),
      prisma.studySession.aggregate({ where: { learnerId: learner.id }, _sum: { seconds: true }, _count: true }),
      prisma.studySession.findMany({ where: { learnerId: learner.id, day: { gte: since30 } }, select: { seconds: true, mode: true, label: true, revision: { select: { subject: true } } } }),
      prisma.todoItem.count({ where: { learnerId: learner.id, doneAt: { not: null } } }),
      prisma.habitCheck.count({ where: { habit: { learnerId: learner.id } } }),
      prisma.journalEntry.count({ where: { learnerId: learner.id } }),
      prisma.notion.count({ where: { revision: { learnerId: learner.id }, mastery: "mastered", children: { none: {} } } }),
    ]);
    const secondsByDay = new Map(perDay.map((r) => [r.day, r._sum.seconds ?? 0]));
    const days = Array.from({ length: 84 }, (_, i) => {
      const day = addDays(from, i);
      return { day, minutes: Math.round((secondsByDay.get(day) ?? 0) / 60) };
    });
    const subjects = new Map<string, number>();
    for (const s of recent) {
      const key = s.revision?.subject || (s.mode === "minuteur" ? s.label || "Minuteur" : "Révisions");
      subjects.set(key, (subjects.get(key) ?? 0) + s.seconds);
    }
    const week = days.slice(-7);
    res.json({
      days,
      week,
      totals: {
        minutes: Math.round((all._sum.seconds ?? 0) / 60),
        sessions: all._count,
        minutes30: Math.round(recent.reduce((n, s) => n + s.seconds, 0) / 60),
        weekMinutes: week.reduce((n, x) => n + x.minutes, 0),
        activeDays: days.filter((x) => x.minutes > 0).length,
        todosDone,
        habitChecks,
        journalDays,
        notionsMastered: mastered,
        streak: currentStreak(learner.lastStudyDay, learner.streak, today),
        bestStreak: learner.bestStreak,
      },
      subjects: [...subjects.entries()]
        .map(([subject, seconds]) => ({ subject, minutes: Math.round(seconds / 60) }))
        .filter((x) => x.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 8),
    });
  });

  // ── Agenda ──

  router.get("/learners/:learnerId/agenda", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const [events, exams] = await Promise.all([
      prisma.studyEvent.findMany({ where: { learnerId: learner.id }, orderBy: [{ start: "asc" }] }),
      prisma.revision.findMany({ where: { learnerId: learner.id, examDate: { not: null }, status: "ready" }, select: { id: true, title: true, subject: true, examDate: true } }),
    ]);
    // Slots imported before categories were kept: fill them in from Passerelle now, once.
    const missing = events.filter((e) => e.source === "passerelle" && !e.passerelleCategory && e.passerelleTaskId);
    if (missing.length) {
      const tasks = await prisma.task.findMany({ where: { id: { in: missing.map((e) => e.passerelleTaskId!) } }, select: { id: true, category: true } });
      const byId = new Map(tasks.map((t) => [t.id, t.category]));
      for (const e of missing) {
        const category = byId.get(e.passerelleTaskId!);
        if (!category) continue;
        e.passerelleCategory = category;
        e.kind = kindOfCategory(category);
        await prisma.studyEvent.update({ where: { id: e.id }, data: { passerelleCategory: category, kind: e.kind } });
      }
    }
    res.json({
      events: events.map(serializeEvent),
      exams: exams.map((r) => ({ id: r.id, title: r.title, subject: r.subject, day: parisDay(r.examDate!) })),
      canSync: !!learner.memberId,
    });
  });

  router.post("/learners/:learnerId/agenda/events", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    if ((await prisma.studyEvent.count({ where: { learnerId: learner.id } })) >= 300) return res.status(400).json({ error: "Ton agenda est plein (300 créneaux)." });
    const event = await prisma.studyEvent.create({ data: { ...parsed.data, learnerId: learner.id, createdBy: by(req) } });
    res.status(201).json({ event: serializeEvent(event) });
  });

  /** Saves the slots read from a timetable photo (after the child checked them). */
  router.post("/learners/:learnerId/agenda/events/bulk", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = z
      .object({ replace: z.boolean().default(false), events: z.array(eventBase.extend({ weekday: z.number().int().min(0).max(6), day: z.null().default(null) })).min(1).max(80) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const ok = parsed.data.events.filter((e) => e.start < e.end);
    await prisma.$transaction([
      ...(parsed.data.replace ? [prisma.studyEvent.deleteMany({ where: { learnerId: learner.id, source: "cervelle", kind: "cours", weekday: { not: null } } })] : []),
      prisma.studyEvent.createMany({ data: ok.map((e) => ({ ...e, learnerId: learner.id, createdBy: by(req) })) }),
    ]);
    res.status(201).json({ created: ok.length });
  });

  router.patch("/learners/:learnerId/agenda/events/:eventId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const event = await prisma.studyEvent.findFirst({ where: { id: String(req.params.eventId), learnerId: learner.id } });
    if (!event) return res.status(404).json({ error: "Ce créneau n'existe plus. Il a peut-être été supprimé." });
    const parsed = eventSchema.safeParse({ ...serializeEvent(event), ...req.body });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const updated = await prisma.studyEvent.update({ where: { id: event.id }, data: parsed.data });
    res.json({ event: serializeEvent(updated) });
  });

  router.delete("/learners/:learnerId/agenda/events/:eventId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    await prisma.studyEvent.deleteMany({ where: { id: String(req.params.eventId), learnerId: learner.id } });
    res.status(204).end();
  });

  router.post("/learners/:learnerId/agenda/timetable", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    if (!d.aiConfigured(res)) return;
    const parsed = z
      .object({ files: z.array(z.object({ data: z.string().min(10), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]) })).min(1, "Ajoute une photo").max(3) })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const files = d.decodeFiles(parsed.data.files);
    if (typeof files === "string") return res.status(400).json({ error: files });
    if (!(await d.underDailyLimit(learner.userId, "timetable", res))) return;
    const usage = await d.recordUsage(learner.userId, "timetable", learner.id);
    try {
      res.json({ slots: await d.withUsage(usage.id, () => ai.readTimetable({ files })) });
    } catch (e) {
      if (e instanceof ai.CervelleAiError) return res.status(422).json({ error: e.message });
      throw e;
    }
  });

  /**
   * On a parent's request: Cervelle's slots go to the family planning
   * (as « École » tasks of the child), and the child's Passerelle tasks
   * come into Cervelle's agenda. Running it again updates, never duplicates.
   */
  router.post("/learners/:learnerId/agenda/sync", parentOnly, async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    if (!learner.memberId) return res.status(400).json({ error: "Relie d'abord ce profil à un membre de la famille dans Passerelle.", code: "no_member" });
    const memberId = learner.memberId;
    const direction = z.enum(["both", "to_passerelle", "from_passerelle"]).catch("both").parse(req.body?.direction);
    const familyId = learner.userId;
    const today = parisDay();
    let pushed = 0;
    let pulled = 0;
    let removed = 0;

    const events = await prisma.studyEvent.findMany({ where: { learnerId: learner.id } });
    const ownTaskIds = new Set(events.filter((e) => e.source === "cervelle" && e.passerelleTaskId).map((e) => e.passerelleTaskId!));

    if (direction !== "from_passerelle") {
      for (const e of events.filter((x) => x.source === "cervelle")) {
        if (e.day && e.day < today) continue;
        const weekday = e.weekday ?? weekdayOf(e.day!);
        const data = {
          title: e.title,
          category: categoryOfKind(e.kind),
          weekday,
          date: e.day ? new Date(`${e.day}T12:00:00Z`) : dateForWeekday(weekday as 0),
          time: e.start,
          duration: Math.min(480, Math.max(5, minutesOf(e.end) - minutesOf(e.start))),
          recurring: e.weekday !== null,
          notes: e.room ? `Salle ${e.room} · depuis Cervelle` : "Depuis Cervelle",
        };
        const existing = e.passerelleTaskId ? await prisma.task.findFirst({ where: { id: e.passerelleTaskId, userId: familyId } }) : null;
        if (existing) {
          await prisma.task.update({ where: { id: existing.id }, data });
        } else {
          const task = await prisma.task.create({ data: { ...data, userId: familyId, members: { create: { memberId } } } });
          await prisma.studyEvent.update({ where: { id: e.id }, data: { passerelleTaskId: task.id } });
          ownTaskIds.add(task.id);
        }
        pushed++;
      }
    }

    if (direction !== "to_passerelle") {
      const tasks = await prisma.task.findMany({ where: { userId: familyId, members: { some: { memberId } } } });
      const imported = events.filter((e) => e.source === "passerelle");
      const byTask = new Map(imported.map((e) => [e.passerelleTaskId, e]));
      const live = new Set<string>();
      for (const t of tasks) {
        if (ownTaskIds.has(t.id) || !HHMM.test(t.time)) continue;
        live.add(t.id);
        const data = {
          title: t.title.slice(0, 60),
          kind: kindOfCategory(t.category),
          passerelleCategory: t.category || null,
          weekday: t.recurring ? t.weekday : null,
          day: t.recurring ? null : parisDay(t.date),
          start: t.time,
          end: hhmm(Math.min(minutesOf(t.time) + t.duration, 23 * 60 + 59)),
        };
        const had = byTask.get(t.id);
        if (had) await prisma.studyEvent.update({ where: { id: had.id }, data });
        else await prisma.studyEvent.create({ data: { ...data, learnerId: learner.id, source: "passerelle", passerelleTaskId: t.id, createdBy: "parent" } });
        pulled++;
      }
      const gone = imported.filter((e) => !e.passerelleTaskId || !live.has(e.passerelleTaskId)).map((e) => e.id);
      if (gone.length) removed = (await prisma.studyEvent.deleteMany({ where: { id: { in: gone } } })).count;
    }
    res.json({ pushed, pulled, removed });
  });

  // ── To-do list ──

  router.get("/learners/:learnerId/todos", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const since = new Date(Date.now() - 14 * 86_400_000);
    const todos = await prisma.todoItem.findMany({
      where: { learnerId: learner.id, OR: [{ doneAt: null }, { doneAt: { gte: since } }] },
      orderBy: [{ createdAt: "asc" }],
    });
    res.json({ todos: todos.map(serializeTodo) });
  });

  router.post("/learners/:learnerId/todos", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = todoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    if ((await prisma.todoItem.count({ where: { learnerId: learner.id, doneAt: null } })) >= 100) return res.status(400).json({ error: "Déjà 100 tâches à faire : termine-en quelques-unes !" });
    const todo = await prisma.todoItem.create({ data: { ...parsed.data, learnerId: learner.id, createdBy: by(req) } });
    res.status(201).json({ todo: serializeTodo(todo) });
  });

  router.patch("/learners/:learnerId/todos/:todoId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const todo = await prisma.todoItem.findFirst({ where: { id: String(req.params.todoId), learnerId: learner.id } });
    if (!todo) return res.status(404).json({ error: "Cette tâche n'existe plus. Elle a peut-être été supprimée." });
    const parsed = todoSchema.partial().extend({ done: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const { done, ...fields } = parsed.data;
    const data: Prisma.TodoItemUpdateInput = { ...fields };
    let coins = 0;
    let xp = 0;
    if (done === true && !todo.doneAt) {
      const today = parisDay();
      const recent = await prisma.todoItem.findMany({ where: { learnerId: learner.id, coins: { gt: 0 }, doneAt: { gte: new Date(Date.now() - 26 * 3600_000) } }, select: { doneAt: true } });
      if (recent.filter((t) => parisDay(t.doneAt!) === today).length < TODO_DAILY_CAP) {
        coins = TODO_COINS;
        xp = TODO_XP;
      }
      Object.assign(data, { doneAt: new Date(), coins, xp });
    } else if (done === false && todo.doneAt) {
      Object.assign(data, { doneAt: null, coins: 0, xp: 0 });
      coins = -todo.coins;
      xp = -todo.xp;
    }
    // Conditional on the state read above, so two taps can't pay twice.
    const changed = await prisma.todoItem.updateMany({ where: { id: todo.id, doneAt: todo.doneAt }, data: data as Prisma.TodoItemUpdateManyMutationInput });
    if (changed.count === 0) return res.status(409).json({ error: "Cette tâche a changé entre-temps. Réessaie." });
    const after = coins || xp ? await grant(learner.id, coins, xp) : learner;
    const updated = await prisma.todoItem.findUniqueOrThrow({ where: { id: todo.id } });
    res.json({
      todo: serializeTodo(updated),
      coins,
      xp,
      learner: serializeLearner(after),
      levelUp: levelUpOf(learner, after),
      missions: done !== undefined ? await missionState(after) : undefined,
    });
  });

  router.delete("/learners/:learnerId/todos/:todoId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    await prisma.todoItem.deleteMany({ where: { id: String(req.params.todoId), learnerId: learner.id } });
    res.status(204).end();
  });

  // ── Habits ──

  router.get("/learners/:learnerId/habits", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const from = addDays(parisDay(), -41);
    const habits = await prisma.habit.findMany({
      where: { learnerId: learner.id, archivedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: { checks: { where: { day: { gte: from } }, select: { day: true } } },
    });
    res.json({
      today: parisDay(),
      habits: habits.map((h) => ({ id: h.id, title: h.title, emoji: h.emoji, color: h.color, days: h.days, createdBy: h.createdBy, since: parisDay(h.createdAt), checked: h.checks.map((c) => c.day).sort() })),
    });
  });

  router.post("/learners/:learnerId/habits", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = habitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const count = await prisma.habit.count({ where: { learnerId: learner.id, archivedAt: null } });
    if (count >= 12) return res.status(400).json({ error: "12 habitudes au plus. Garde les plus importantes !" });
    const habit = await prisma.habit.create({ data: { ...parsed.data, days: [...new Set(parsed.data.days)].sort(), order: count, learnerId: learner.id, createdBy: by(req) } });
    res.status(201).json({ habit: { id: habit.id, title: habit.title, emoji: habit.emoji, color: habit.color, days: habit.days, createdBy: habit.createdBy, since: parisDay(habit.createdAt), checked: [] } });
  });

  router.patch("/learners/:learnerId/habits/:habitId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const parsed = habitSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
    const data = parsed.data.days ? { ...parsed.data, days: [...new Set(parsed.data.days)].sort() } : parsed.data;
    const done = await prisma.habit.updateMany({ where: { id: String(req.params.habitId), learnerId: learner.id }, data });
    if (done.count === 0) return res.status(404).json({ error: "Cette habitude n'existe plus. Elle a peut-être été supprimée." });
    res.status(204).end();
  });

  router.delete("/learners/:learnerId/habits/:habitId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    await prisma.habit.updateMany({ where: { id: String(req.params.habitId), learnerId: learner.id }, data: { archivedAt: new Date() } });
    res.status(204).end();
  });

  /** Tick a habit for today (rewarded) or yesterday (forgot to tick, not rewarded). */
  router.post("/learners/:learnerId/habits/:habitId/check", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const habit = await prisma.habit.findFirst({ where: { id: String(req.params.habitId), learnerId: learner.id, archivedAt: null } });
    if (!habit) return res.status(404).json({ error: "Cette habitude n'existe plus. Elle a peut-être été supprimée." });
    const today = parisDay();
    const day = typeof req.body?.day === "string" ? req.body.day : today;
    if (day !== today && day !== addDays(today, -1)) return res.status(400).json({ error: "Tu peux cocher aujourd'hui ou hier seulement." });
    const coins = day === today ? HABIT_COINS : 0;
    const xp = day === today ? HABIT_XP : 0;
    try {
      await prisma.habitCheck.create({ data: { habitId: habit.id, day, coins, xp } });
    } catch {
      return res.json({ coins: 0, xp: 0, learner: serializeLearner(learner), missions: await missionState(learner) });
    }
    const after = await grant(learner.id, coins, xp);
    res.status(201).json({ coins, xp, learner: serializeLearner(after), levelUp: levelUpOf(learner, after), missions: await missionState(after) });
  });

  router.delete("/learners/:learnerId/habits/:habitId/check", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const day = typeof req.query.day === "string" ? req.query.day : parisDay();
    const habit = await prisma.habit.findFirst({ where: { id: String(req.params.habitId), learnerId: learner.id } });
    if (!habit) return res.status(404).json({ error: "Cette habitude n'existe plus. Elle a peut-être été supprimée." });
    const check = await prisma.habitCheck.findUnique({ where: { habitId_day: { habitId: habit.id, day } } });
    if (!check) return res.json({ learner: serializeLearner(learner) });
    const gone = await prisma.habitCheck.deleteMany({ where: { id: check.id } });
    const after = gone.count ? await grant(learner.id, -check.coins, -check.xp) : learner;
    res.json({ learner: serializeLearner(after), missions: await missionState(after) });
  });

  // ── Journal ──

  router.get("/learners/:learnerId/journal", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const entries = await prisma.journalEntry.findMany({ where: { learnerId: learner.id }, orderBy: { day: "desc" }, take: 60 });
    res.json({ today: parisDay(), entries: entries.map((e) => ({ day: e.day, mood: e.mood, learned: e.learned, proud: e.proud, hard: e.hard })) });
  });

  router.put("/learners/:learnerId/journal/:day", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const day = String(req.params.day);
    const today = parisDay();
    if (!DAY.test(day) || day > today || day < addDays(today, -6)) return res.status(400).json({ error: "Tu peux écrire pour aujourd'hui ou les 6 derniers jours." });
    const parsed = journalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Choisis comment s'est passée ta journée." });
    const entry = await prisma.journalEntry.upsert({
      where: { learnerId_day: { learnerId: learner.id, day } },
      create: { ...parsed.data, learnerId: learner.id, day },
      update: parsed.data,
    });
    res.json({ entry: { day: entry.day, mood: entry.mood, learned: entry.learned, proud: entry.proud, hard: entry.hard }, missions: await missionState(learner) });
  });

  // ── Friends ──

  router.get("/learners/:learnerId/friends", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const today = parisDay();
    const monday = mondayOf(today);
    await settleChallenges(learner.id, monday);
    const code = await ensureFriendCode(learner);
    const { siblings, friends } = await circleOf(learner);
    const everyone = [learner, ...siblings, ...friends.map((f) => f.learner)];
    const minutes = await minutesBetween(
      everyone.map((l) => l.id),
      monday,
      addDays(monday, 7),
    );
    const [pending, cheers, challenges] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ fromId: learner.id }, { toId: learner.id }], NOT: { fromApproved: true, toApproved: true } },
        include: { from: true, to: true },
      }),
      prisma.cheer.findMany({ where: { toId: learner.id, seenAt: null }, orderBy: { createdAt: "desc" }, take: 20, include: { from: true } }),
      prisma.challenge.findMany({
        where: { OR: [{ fromId: learner.id }, { toId: learner.id }], week: { gte: addDays(monday, -7) }, status: { not: "declined" } },
        include: { from: true, to: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const me = (await prisma.learner.findUniqueOrThrow({ where: { id: learner.id } })) as Learner;
    const board = [
      { ...publicLearner(me), weekMinutes: minutes.get(me.id) ?? 0, me: true, sibling: false, friendshipId: null as string | null },
      ...siblings.map((s) => ({ ...publicLearner(s), weekMinutes: minutes.get(s.id) ?? 0, me: false, sibling: true, friendshipId: null as string | null })),
      ...friends.map((f) => ({ ...publicLearner(f.learner), weekMinutes: minutes.get(f.learner.id) ?? 0, me: false, sibling: false, friendshipId: f.friendshipId as string | null })),
    ].sort((a, b) => b.weekMinutes - a.weekMinutes || a.name.localeCompare(b.name));
    res.json({
      code,
      week: monday,
      board,
      pending: pending.map((p) => ({ id: p.id, name: p.fromId === learner.id ? p.to.name : p.from.name, outgoing: p.fromId === learner.id })),
      cheers: cheers.map((c) => ({ id: c.id, fromName: c.from.name, kind: c.kind, emoji: cheerById(c.kind)?.emoji ?? "💬", label: cheerById(c.kind)?.label ?? "", createdAt: c.createdAt.toISOString() })),
      cheerKinds: CHEERS,
      challenges: challenges.map((c) => {
        const mine = c.fromId === learner.id;
        const other = mine ? c.to : c.from;
        const live = c.status === "active" && c.week === monday;
        return {
          id: c.id,
          week: c.week,
          status: c.status,
          sentByMe: mine,
          other: publicLearner(other),
          myMinutes: live ? (minutes.get(learner.id) ?? 0) : ((mine ? c.fromMinutes : c.toMinutes) ?? 0),
          theirMinutes: live ? (minutes.get(other.id) ?? 0) : ((mine ? c.toMinutes : c.fromMinutes) ?? 0),
          result: c.status !== "done" ? null : c.winnerId === "tie" ? "tie" : c.winnerId === learner.id ? "won" : c.winnerId ? "lost" : "none",
          prize: CHALLENGE_COINS,
        };
      }),
    });
  });

  /** A child (or their parent) types a friend's code: a request both parents must approve. */
  router.post("/learners/:learnerId/friends", friendLimiter, async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const code = String(req.body?.code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) return res.status(400).json({ error: "Le code d'ami a 6 caractères." });
    const other = await prisma.learner.findUnique({ where: { friendCode: code } });
    if (!other) return res.status(404).json({ error: "Aucun élève avec ce code. Vérifie les lettres." });
    if (other.id === learner.id) return res.status(400).json({ error: "C'est ton propre code !" });
    if (other.userId === learner.userId) return res.status(400).json({ error: "C'est quelqu'un de ta famille : vous êtes déjà dans le même classement." });
    const exists = await prisma.friendship.findFirst({ where: { OR: [{ fromId: learner.id, toId: other.id }, { fromId: other.id, toId: learner.id }] } });
    if (exists) return res.status(409).json({ error: exists.fromApproved && exists.toApproved ? "Vous êtes déjà amis !" : "Demande déjà envoyée. Vos parents doivent dire oui." });
    const count = await prisma.friendship.count({ where: { OR: [{ fromId: learner.id }, { toId: learner.id }] } });
    if (count >= MAX_FRIENDS) return res.status(400).json({ error: `${MAX_FRIENDS} amis au plus.` });
    const f = await prisma.friendship.create({ data: { fromId: learner.id, toId: other.id, fromApproved: req.cervelle!.kind === "parent" } });
    res.status(201).json({ friendship: { id: f.id, name: other.name, outgoing: true } });
  });

  router.delete("/learners/:learnerId/friends/:friendshipId", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    await prisma.friendship.deleteMany({ where: { id: String(req.params.friendshipId), OR: [{ fromId: learner.id }, { toId: learner.id }] } });
    res.status(204).end();
  });

  router.post("/learners/:learnerId/cheers", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const toId = String(req.body?.toId ?? "");
    const kind = cheerById(String(req.body?.kind ?? ""));
    if (!kind) return res.status(400).json({ error: "Choisis un encouragement dans la liste." });
    if (!(await inCircle(learner, toId))) return res.status(404).json({ error: "Cet ami n'est plus dans ta liste." });
    const sent = await prisma.cheer.count({ where: { fromId: learner.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    if (sent >= CHEERS_PER_DAY) return res.status(429).json({ error: "Tu as envoyé beaucoup d'encouragements aujourd'hui. Reviens demain !" });
    await prisma.cheer.create({ data: { fromId: learner.id, toId, kind: kind.id } });
    res.status(201).json({ ok: true });
  });

  router.post("/learners/:learnerId/cheers/seen", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    // A parent looking at the child's space doesn't mark them as read.
    if (req.cervelle!.kind === "child") await prisma.cheer.updateMany({ where: { toId: learner.id, seenAt: null }, data: { seenAt: new Date() } });
    res.status(204).end();
  });

  router.post("/learners/:learnerId/challenges", async (req, res) => {
    const learner = await loadLearner(req, res);
    if (!learner) return;
    const toId = String(req.body?.toId ?? "");
    if (!(await inCircle(learner, toId))) return res.status(404).json({ error: "Cet ami n'est plus dans ta liste." });
    const week = mondayOf(parisDay());
    const exists = await prisma.challenge.findFirst({
      where: { week, status: { in: ["pending", "active"] }, OR: [{ fromId: learner.id, toId }, { fromId: toId, toId: learner.id }] },
    });
    if (exists) return res.status(409).json({ error: "Vous avez déjà un défi cette semaine." });
    const c = await prisma.challenge.create({ data: { fromId: learner.id, toId, week } });
    res.status(201).json({ challenge: { id: c.id, status: c.status } });
  });

  for (const action of ["accept", "decline"] as const) {
    router.post(`/learners/:learnerId/challenges/:challengeId/${action}`, async (req, res) => {
      const learner = await loadLearner(req, res);
      if (!learner) return;
      const done = await prisma.challenge.updateMany({
        where: { id: String(req.params.challengeId), toId: learner.id, status: "pending", week: mondayOf(parisDay()) },
        data: { status: action === "accept" ? "active" : "declined" },
      });
      if (done.count === 0) return res.status(404).json({ error: "Ce défi est déjà terminé." });
      res.status(204).end();
    });
  }

  // ── Parents: friend requests to approve ──

  router.get("/friend-requests", parentOnly, async (req, res) => {
    const familyId = req.cervelle!.familyId;
    const list = await prisma.friendship.findMany({
      where: {
        OR: [
          { fromApproved: false, from: { userId: familyId } },
          { toApproved: false, to: { userId: familyId } },
        ],
      },
      include: { from: true, to: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({
      requests: list.map((f) => {
        const mineIsFrom = f.from.userId === familyId;
        const child = mineIsFrom ? f.from : f.to;
        const other = mineIsFrom ? f.to : f.from;
        return {
          id: f.id,
          child: { id: child.id, name: child.name },
          other: { name: other.name, grade: other.grade, level: other.level },
          outgoing: mineIsFrom,
          // The other family's answer, so the parent knows what's still missing.
          otherApproved: mineIsFrom ? f.toApproved : f.fromApproved,
          createdAt: f.createdAt.toISOString(),
        };
      }),
    });
  });

  router.post("/friend-requests/:id/approve", parentOnly, async (req, res) => {
    const familyId = req.cervelle!.familyId;
    const f = await prisma.friendship.findUnique({ where: { id: String(req.params.id) }, include: { from: true, to: true } });
    if (!f || (f.from.userId !== familyId && f.to.userId !== familyId)) return res.status(404).json({ error: "Cette demande n'existe plus. L'autre famille l'a peut-être annulée." });
    const updated = await prisma.friendship.update({
      where: { id: f.id },
      data: { ...(f.from.userId === familyId ? { fromApproved: true } : {}), ...(f.to.userId === familyId ? { toApproved: true } : {}) },
    });
    res.json({ friends: updated.fromApproved && updated.toApproved });
  });

  router.delete("/friend-requests/:id", parentOnly, async (req, res) => {
    const familyId = req.cervelle!.familyId;
    await prisma.friendship.deleteMany({ where: { id: String(req.params.id), OR: [{ from: { userId: familyId } }, { to: { userId: familyId } }] } });
    res.status(204).end();
  });
}
