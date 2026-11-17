import crypto from "node:crypto";
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import type { Learner, Notion, Prisma, Question, Revision } from "@prisma/client";
import { prisma } from "../db";
import { isMealAiConfigured } from "../env";
import { verifyAccessToken } from "../lib/jwt";
import { resolveSpace } from "../lib/family";
import { getStorage, removeObjects } from "../lib/storage";
import { beforeParisDay, parisDay, weekdayOf } from "../lib/cervelle/days";
import { mountOrganize } from "./cervelleOrganize";
import { applyAnswer, combinedMastery, displayedMastery, revisionProgress, type Mastery } from "../lib/cervelle/mastery";
import { localGrade, normalizeAnswer, sameOrder } from "../lib/cervelle/grading";
import {
  CHEST_COINS,
  COINS_GREAT_EXAM,
  COINS_PER_RIGHT_ANSWER,
  COINS_PER_SESSION,
  COINS_SHEETS_READ,
  SHOP,
  XP_PER_ANSWER,
  XP_PER_RIGHT_ANSWER,
  currentStreak,
  equip,
  timerDefaults,
  levelOf,
  missions,
  nextStreak,
  shopItem,
} from "../lib/cervelle/game";
import { LEVELS, REVISION_ICONS, type Level } from "../lib/cervelle/icons";
import { SCHOOL_YEAR, chapterById, findChapter, programmeFor, programmeForPrompt } from "../lib/cervelle/programme";
import { notifyRevisionReady } from "../lib/cervelle/push";
import * as ai from "../services/cervelleAi";

// Cervelle — révisions à partir des cours en photo. A separate app, same
// server and same family accounts as Passerelle.
//
// Two kinds of callers:
//   - a parent, with their Passerelle access token: manages the children's
//     profiles, sees their progress, and can do everything a child can;
//   - a child, on their own phone, with a device token (« cv_… ») obtained
//     once with a 6-digit code the parent generated. A child only reaches
//     their own profile, addressed as /learners/me/….
//
// Claude prepares a revision in the background: POST answers 202 with the
// revision in « processing », the app polls GET until « ready » or « failed ».

export const cervelleRouter = Router();

const CODE_TTL_MS = 15 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_FILES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;

/** Claude calls per family and per day. */
export const DAILY_LIMITS = { revision: 15, exam: 10, assistant: 120, grading: 400, timetable: 10 } as const;

type Caller = { kind: "parent"; familyId: string } | { kind: "child"; familyId: string; learnerId: string; deviceId: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      cervelle?: Caller;
    }
  }
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// ─── Auth ────────────────────────────────────────────────────────────────

async function cervelleAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Connecte-toi pour continuer." });
  const token = header.slice("Bearer ".length);

  if (token.startsWith("cv_")) {
    const device = await prisma.learnerDevice.findUnique({ where: { tokenHash: sha256(token) }, include: { learner: { select: { userId: true } } } });
    if (!device) return res.status(401).json({ error: "Ce téléphone a été déconnecté. Demande un nouveau code à tes parents.", code: "device_revoked" });
    if (Date.now() - device.lastSeenAt.getTime() > 60 * 60 * 1000) {
      await prisma.learnerDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    }
    req.cervelle = { kind: "child", familyId: device.learner.userId, learnerId: device.learnerId, deviceId: device.id };
    return next();
  }

  let accountId: string;
  try {
    accountId = verifyAccessToken(token).sub;
  } catch {
    return res.status(401).json({ error: "Tu as été déconnecté. Reconnecte-toi pour continuer." });
  }
  const space = await resolveSpace(accountId);
  if (!space) return res.status(401).json({ error: "Tu as été déconnecté. Reconnecte-toi pour continuer." });
  req.cervelle = { kind: "parent", familyId: space.familyId };
  next();
}

export function parentOnly(req: Request, res: Response, next: NextFunction) {
  if (req.cervelle?.kind !== "parent") return res.status(403).json({ error: "Réservé aux parents." });
  next();
}

/** The learner a request is about, or null (and the response is sent). */
export async function loadLearner(req: Request, res: Response): Promise<Learner | null> {
  const caller = req.cervelle!;
  const id = String(req.params.learnerId);
  if (caller.kind === "child") {
    if (id !== "me" && id !== caller.learnerId) {
      res.status(404).json({ error: "Profil introuvable" });
      return null;
    }
    const learner = await prisma.learner.findUnique({ where: { id: caller.learnerId } });
    if (!learner) res.status(404).json({ error: "Profil introuvable" });
    return learner;
  }
  const learner = await prisma.learner.findFirst({ where: { id, userId: caller.familyId } });
  if (!learner) res.status(404).json({ error: "Profil introuvable" });
  return learner;
}

const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.DISABLE_RATE_LIMIT === "1",
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Trop d'essais. Réessaie dans 15 minutes." },
});

async function usedToday(familyId: string, kind: keyof typeof DAILY_LIMITS) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.aiUsage.count({ where: { userId: familyId, kind, createdAt: { gte: since } } });
}

export async function underDailyLimit(familyId: string, kind: keyof typeof DAILY_LIMITS, res: Response) {
  if ((await usedToday(familyId, kind)) >= DAILY_LIMITS[kind]) {
    res.status(429).json({ error: "Limite du jour atteinte pour la famille. Réessaie demain.", code: "daily_limit" });
    return false;
  }
  return true;
}

export const recordUsage = (familyId: string, kind: keyof typeof DAILY_LIMITS) => prisma.aiUsage.create({ data: { userId: familyId, kind } });

export function aiConfigured(res: Response) {
  if (isMealAiConfigured()) return true;
  res.status(503).json({ error: "Cervelle ne peut pas préparer de révision pour le moment. Préviens tes parents." });
  return false;
}

// ─── Child sign-in ───────────────────────────────────────────────────────

const loginSchema = z.object({ code: z.string().trim(), deviceName: z.string().trim().max(60).default("") });

cervelleRouter.post("/child/login", codeLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  const digits = parsed.success ? parsed.data.code.replace(/\D/g, "") : "";
  if (digits.length !== 6) return res.status(400).json({ error: "Le code a 6 chiffres." });
  const code = await prisma.learnerCode.findUnique({ where: { codeHash: sha256(digits) }, include: { learner: true } });
  if (!code || code.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "Code inconnu ou expiré. Demande un nouveau code à tes parents." });
  }
  const token = `cv_${crypto.randomBytes(32).toString("hex")}`;
  await prisma.$transaction([
    prisma.learnerCode.delete({ where: { id: code.id } }),
    prisma.learnerDevice.create({ data: { learnerId: code.learnerId, tokenHash: sha256(token), name: parsed.data!.deviceName } }),
  ]);
  res.status(201).json({ token, learner: serializeLearner(code.learner) });
});

cervelleRouter.use(cervelleAuth);

cervelleRouter.post("/child/logout", async (req, res) => {
  const caller = req.cervelle!;
  if (caller.kind === "child") await prisma.learnerDevice.deleteMany({ where: { id: caller.deviceId } });
  res.status(204).end();
});

// ─── Notifications on the child's phone ─────────────────────────────────

const childPushSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]{1,200}\]$/).nullable(),
  readyAlert: z.boolean().optional(),
});

/** The child's phone registers its Expo push token (null = notifications refused or turned off). */
cervelleRouter.put("/child/push", async (req, res) => {
  const caller = req.cervelle!;
  if (caller.kind !== "child") return res.status(403).json({ error: "Réservé au téléphone de l'enfant." });
  const parsed = childPushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
  const { token, readyAlert } = parsed.data;
  await prisma.$transaction([
    // A phone handed to another child (or relinked) keeps only its newest link.
    ...(token ? [prisma.learnerDevice.updateMany({ where: { pushToken: token, NOT: { id: caller.deviceId } }, data: { pushToken: null } })] : []),
    prisma.learnerDevice.update({ where: { id: caller.deviceId }, data: { pushToken: token, ...(readyAlert !== undefined ? { readyAlert } : {}) } }),
  ]);
  res.status(204).end();
});

/**
 * What the phone needs to schedule its own reminders: upcoming interros of
 * ready revisions, notions « À revoir » now, and when mastered notions come
 * back to « À revoir » over the next days.
 */
cervelleRouter.get("/learners/:learnerId/reminders", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const now = new Date();
  const today = parisDay(now);
  const [revisions, notions] = await Promise.all([
    prisma.revision.findMany({
      where: { learnerId: learner.id, status: "ready", examDate: { gte: new Date(`${today}T00:00:00Z`) } },
      select: { id: true, title: true, subject: true, examDate: true },
      orderBy: { examDate: "asc" },
      take: 30,
    }),
    prisma.notion.findMany({ where: { revision: { learnerId: learner.id, status: "ready" } } }),
  ]);
  const leafNotions = leaves(notions);
  const horizon = now.getTime() + 8 * 86_400_000;
  res.json({
    exams: revisions.map((r) => ({ revisionId: r.id, title: r.title, subject: r.subject, examDate: r.examDate!.toISOString().slice(0, 10) })),
    reviewNow: leafNotions.filter((n) => labelOf(n, now) === "review").length,
    // Mastered notions whose review falls due in the next 8 days.
    reviewDue: leafNotions
      .filter((n) => n.mastery === "mastered" && n.nextReviewAt && n.nextReviewAt.getTime() > now.getTime() && n.nextReviewAt.getTime() <= horizon)
      .map((n) => n.nextReviewAt!.toISOString())
      .sort(),
  });
});

/** Who is calling: a parent (and their family's learners) or a child. */
cervelleRouter.get("/session", async (req, res) => {
  const caller = req.cervelle!;
  if (caller.kind === "child") {
    const learner = await prisma.learner.findUnique({ where: { id: caller.learnerId } });
    return res.json({ kind: "child", learner: learner && serializeLearner(learner) });
  }
  res.json({ kind: "parent" });
});

// ─── Learners (parent) ───────────────────────────────────────────────────

export function serializeLearner(l: Learner) {
  const today = parisDay();
  return {
    id: l.id,
    name: l.name,
    level: l.level,
    grade: l.grade,
    color: l.color,
    memberId: l.memberId,
    coins: l.coins,
    streak: currentStreak(l.lastStudyDay, l.streak, today),
    bestStreak: l.bestStreak,
    mascot: levelOf(l.xp),
    owned: l.owned,
    equipped: l.equipped,
    timer: { focus: l.focusMinutes ?? timerDefaults(l.level).focus, pause: l.breakMinutes ?? timerDefaults(l.level).pause },
    studyProfile: l.studyProfile ?? null,
  };
}

const COLORS = ["violet", "corail", "menthe", "soleil", "ciel", "framboise"] as const;

const learnerSchema = z.object({
  name: z.string().trim().min(1, "Indique un prénom").max(40),
  level: z.enum(LEVELS),
  grade: z.string().trim().max(30).default(""),
  color: z.enum(COLORS).default("violet"),
  memberId: z.string().nullable().optional(),
});

cervelleRouter.get("/learners", parentOnly, async (req, res) => {
  const learners = await prisma.learner.findMany({ where: { userId: req.cervelle!.familyId }, orderBy: { createdAt: "asc" } });
  res.json({ learners: learners.map(serializeLearner) });
});

cervelleRouter.post("/learners", parentOnly, async (req, res) => {
  const parsed = learnerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const familyId = req.cervelle!.familyId;
  const d = parsed.data;
  if (d.memberId && !(await prisma.familyMember.findFirst({ where: { id: d.memberId, userId: familyId } }))) {
    return res.status(400).json({ error: "Membre de la famille introuvable" });
  }
  if ((await prisma.learner.count({ where: { userId: familyId } })) >= 8) return res.status(400).json({ error: "8 profils au plus par famille." });
  const learner = await prisma.learner.create({ data: { userId: familyId, name: d.name, level: d.level, grade: d.grade, color: d.color, memberId: d.memberId ?? null } });
  res.status(201).json({ learner: serializeLearner(learner) });
});

cervelleRouter.patch("/learners/:learnerId", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const parsed = learnerSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  if (d.memberId && !(await prisma.familyMember.findFirst({ where: { id: d.memberId, userId: learner.userId } }))) {
    return res.status(400).json({ error: "Membre de la famille introuvable" });
  }
  const updated = await prisma.learner.update({ where: { id: learner.id }, data: d });
  res.json({ learner: serializeLearner(updated) });
});

cervelleRouter.delete("/learners/:learnerId", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revisions = await prisma.revision.findMany({ where: { learnerId: learner.id }, select: { photoKeys: true } });
  const exams = await prisma.examReview.findMany({ where: { learnerId: learner.id }, select: { photoKeys: true } });
  await prisma.learner.delete({ where: { id: learner.id } });
  await removeObjects([...revisions, ...exams].flatMap((r) => r.photoKeys));
  res.status(204).end();
});

/** A 6-digit code, valid 15 minutes, to link a child's phone. */
cervelleRouter.post("/learners/:learnerId/code", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  await prisma.learnerCode.deleteMany({ where: { OR: [{ learnerId: learner.id }, { expiresAt: { lt: new Date() } }] } });
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);
    try {
      await prisma.learnerCode.create({ data: { learnerId: learner.id, codeHash: sha256(code), expiresAt } });
      return res.status(201).json({ code, expiresAt: expiresAt.toISOString() });
    } catch {
      // Same code already active for another child: draw again.
    }
  }
  res.status(503).json({ error: "Impossible de créer un code pour le moment. Réessaie." });
});

cervelleRouter.get("/learners/:learnerId/devices", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const devices = await prisma.learnerDevice.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" } });
  res.json({ devices: devices.map((d) => ({ id: d.id, name: d.name, createdAt: d.createdAt.toISOString(), lastSeenAt: d.lastSeenAt.toISOString() })) });
});

cervelleRouter.delete("/learners/:learnerId/devices/:deviceId", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  await prisma.learnerDevice.deleteMany({ where: { id: String(req.params.deviceId), learnerId: learner.id } });
  res.status(204).end();
});

/** The parent's dashboard for one child. */
cervelleRouter.get("/learners/:learnerId/overview", parentOnly, async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const now = Date.now();
  const DAY = 86_400_000;
  const [all, last30, prev30, lastSession, recent] = await Promise.all([
    prisma.studySession.aggregate({ where: { learnerId: learner.id }, _sum: { seconds: true }, _count: true }),
    prisma.studySession.aggregate({ where: { learnerId: learner.id, createdAt: { gte: new Date(now - 30 * DAY) } }, _sum: { seconds: true }, _count: true }),
    prisma.studySession.aggregate({ where: { learnerId: learner.id, createdAt: { gte: new Date(now - 60 * DAY), lt: new Date(now - 30 * DAY) } }, _sum: { seconds: true } }),
    prisma.studySession.findFirst({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" } }),
    prisma.studySession.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 8, include: { revision: { select: { title: true } } } }),
  ]);
  const cur = last30._sum.seconds ?? 0;
  const prev = prev30._sum.seconds ?? 0;
  const change = prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

  const revisions = await revisionCards(learner.id);
  const today = parisDay();
  const upcoming = revisions
    .filter((r) => r.examDate && r.examDate >= today)
    .sort((a, b) => a.examDate!.localeCompare(b.examDate!));
  const counts = revisions.reduce((acc, r) => ({ mastered: acc.mastered + r.counts.mastered, review: acc.review + r.counts.review, new: acc.new + r.counts.new }), { mastered: 0, review: 0, new: 0 });

  res.json({
    learner: serializeLearner(learner),
    time: { last30Seconds: cur, totalSeconds: all._sum.seconds ?? 0, changePercent: change, sessionsLast30: last30._count, sessionsTotal: all._count },
    lastActiveAt: lastSession?.createdAt.toISOString() ?? null,
    notions: counts,
    upcoming,
    revisions,
    recentSessions: recent.map((s) => ({ id: s.id, mode: s.mode, seconds: s.seconds, correct: s.correct, total: s.total, revisionTitle: s.revision?.title ?? (s.label || null), createdAt: s.createdAt.toISOString() })),
  });
});

// ─── Revisions ───────────────────────────────────────────────────────────

type NotionWithChildren = Notion & { children: Notion[] };

function labelOf(n: Notion, now = new Date()): Mastery {
  return displayedMastery({ mastery: n.mastery, nextReviewAt: n.nextReviewAt }, now);
}

/** Leaf notions are the ones questions hang on; a parent shows the weakest of its leaves. */
function leaves(notions: Notion[]): Notion[] {
  const parents = new Set(notions.map((n) => n.parentId).filter(Boolean));
  return notions.filter((n) => !parents.has(n.id));
}

async function failStale(revision: Revision): Promise<Revision> {
  if (revision.status === "processing" && Date.now() - revision.updatedAt.getTime() > PROCESSING_TIMEOUT_MS) {
    return prisma.revision.update({ where: { id: revision.id }, data: { status: "failed", error: "La préparation a été interrompue. Relance-la." } });
  }
  return revision;
}

async function revisionCards(learnerId: string) {
  const revisions = await prisma.revision.findMany({ where: { learnerId }, orderBy: { createdAt: "desc" }, include: { notions: true } });
  const now = new Date();
  return Promise.all(
    revisions.map(async (raw) => {
      const r = await failStale(raw);
      const leafs = leaves(raw.notions);
      const labels = leafs.map((n) => labelOf(n, now));
      const counts = { mastered: labels.filter((l) => l === "mastered").length, review: labels.filter((l) => l === "review").length, new: labels.filter((l) => l === "new").length };
      return {
        id: r.id,
        title: r.title,
        subject: r.subject,
        icon: r.icon,
        status: r.status,
        error: r.error,
        examDate: r.examDate ? r.examDate.toISOString().slice(0, 10) : null,
        createdAt: r.createdAt.toISOString(),
        createdBy: r.createdBy,
        photoCount: r.photoCount,
        counts,
        programmeChapterId: r.programmeChapterId,
        progress: revisionProgress({ sheetsRead: !!r.sheetsReadAt, quizBest: r.quizBest, examBest: r.examBest, mastered: counts.mastered, notions: leafs.length }),
      };
    }),
  );
}

cervelleRouter.get("/learners/:learnerId/revisions", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  res.json({ revisions: await revisionCards(learner.id) });
});

/** The official programme of the learner's class, chapter by chapter, with what has been revised. */
cervelleRouter.get("/learners/:learnerId/programme", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const subjects = SCHOOL_LEVELS.has(learner.level) ? programmeFor(learner.grade) : null;
  if (!subjects) return res.json({ available: false, grade: learner.grade, schoolYear: SCHOOL_YEAR, subjects: [] });
  const cards = (await revisionCards(learner.id)).filter((r) => r.status === "ready" && r.programmeChapterId);
  res.json({
    available: true,
    grade: learner.grade,
    schoolYear: SCHOOL_YEAR,
    subjects: subjects.map((s) => ({
      subject: s.subject,
      source: s.source,
      verified: s.verifie,
      cycleWide: !!s.cycleWide,
      chapters: s.chapters.map((c) => {
        const revisions = cards.filter((r) => r.programmeChapterId === c.id).map((r) => ({ id: r.id, title: r.title, progress: r.progress }));
        const best = Math.max(-1, ...revisions.map((r) => r.progress));
        return { id: c.id, title: c.title, notions: c.notions, revisions, status: best < 0 ? "todo" : best >= 80 ? "mastered" : "started" };
      }),
    })),
  });
});

async function loadRevision(req: Request, res: Response, learner: Learner) {
  const revision = await prisma.revision.findFirst({ where: { id: String(req.params.revisionId), learnerId: learner.id } });
  if (!revision) {
    res.status(404).json({ error: "Révision introuvable" });
    return null;
  }
  return failStale(revision);
}

function programmeInfo(chapterId: string | null) {
  const found = chapterId ? chapterById(chapterId) : null;
  return found ? { chapterId: found.chapter.id, chapter: found.chapter.title, subject: found.subject.subject, grade: found.grade } : null;
}

function serializeRevisionDetail(r: Revision, notions: NotionWithChildren[], questionCount: number) {
  const now = new Date();
  const roots = notions.filter((n) => !n.parentId).sort((a, b) => a.order - b.order);
  const leafs = leaves(notions);
  const leafLabels = leafs.map((n) => labelOf(n, now));
  const mastered = leafLabels.filter((l) => l === "mastered").length;
  return {
    id: r.id,
    title: r.title,
    subject: r.subject,
    icon: r.icon,
    status: r.status,
    error: r.error,
    summary: r.summary,
    examDate: r.examDate ? r.examDate.toISOString().slice(0, 10) : null,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    photoCount: r.photoCount,
    questionCount,
    steps: { sheets: !!r.sheetsReadAt, quizBest: r.quizBest, examBest: r.examBest },
    programme: programmeInfo(r.programmeChapterId),
    progress: revisionProgress({ sheetsRead: !!r.sheetsReadAt, quizBest: r.quizBest, examBest: r.examBest, mastered, notions: leafs.length }),
    notions: roots.map((root) => {
      const children = root.children.sort((a, b) => a.order - b.order);
      const childLabels = children.map((c) => labelOf(c, now));
      return {
        id: root.id,
        title: root.title,
        mastery: children.length ? combinedMastery(childLabels) : labelOf(root, now),
        children: children.map((c, i) => ({ id: c.id, title: c.title, mastery: childLabels[i], fromProgramme: c.fromProgramme })),
      };
    }),
    sheets: r.sheets,
  };
}

cervelleRouter.get("/learners/:learnerId/revisions/:revisionId", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revision = await loadRevision(req, res, learner);
  if (!revision) return;
  const [notions, questionCount] = await Promise.all([
    prisma.notion.findMany({ where: { revisionId: revision.id }, include: { children: true } }),
    prisma.question.count({ where: { revisionId: revision.id } }),
  ]);
  res.json({ revision: serializeRevisionDetail(revision, notions, questionCount) });
});

export const fileSchema = z.object({
  data: z.string().min(10),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
});

const createRevisionSchema = z.object({
  files: z.array(fileSchema).min(1, "Ajoute au moins une photo du cours").max(MAX_FILES, `${MAX_FILES} photos au plus`),
  title: z.string().trim().max(120).default(""),
  subject: z.string().trim().max(60).default(""),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

/** Decodes and checks the uploaded files (real images or PDF, sizes). */
export function decodeFiles(files: z.infer<typeof fileSchema>[]): ai.CourseFile[] | string {
  const out: ai.CourseFile[] = [];
  for (const f of files) {
    const data = Buffer.from(f.data, "base64");
    const magic = data.subarray(0, 12);
    const ok =
      (f.mimeType === "image/jpeg" && magic[0] === 0xff && magic[1] === 0xd8) ||
      (f.mimeType === "image/png" && magic.subarray(1, 4).toString("latin1") === "PNG") ||
      (f.mimeType === "image/webp" && magic.subarray(8, 12).toString("latin1") === "WEBP") ||
      (f.mimeType === "application/pdf" && magic.subarray(0, 5).toString("latin1") === "%PDF-");
    if (!ok) return "Un des fichiers n'est pas une photo ou un PDF valide.";
    const max = f.mimeType === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
    if (data.length > max) return f.mimeType === "application/pdf" ? "PDF trop lourd (15 Mo au plus)." : "Photo trop lourde (5 Mo au plus).";
    out.push({ data, mimeType: f.mimeType });
  }
  return out;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

async function storeFiles(prefix: string, files: ai.CourseFile[]): Promise<string[]> {
  const storage = getStorage();
  if (!storage?.putObject) return [];
  const keys: string[] = [];
  try {
    for (const [i, f] of files.entries()) {
      const key = `${prefix}/${i + 1}.${EXT[f.mimeType]}`;
      await storage.putObject(key, f.data, f.mimeType);
      keys.push(key);
    }
  } catch (e) {
    // Keeping the photos is a nice-to-have: the revision is prepared anyway.
    console.error("Cervelle: photos not stored", e);
  }
  return keys;
}

async function loadStoredFiles(keys: string[]): Promise<ai.CourseFile[] | null> {
  const storage = getStorage();
  if (!storage?.getObject || keys.length === 0) return null;
  const files: ai.CourseFile[] = [];
  for (const key of keys) {
    const data = await storage.getObject(key);
    if (!data) return null;
    const ext = key.split(".").pop() ?? "jpg";
    const mimeType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "image/jpeg";
    files.push({ data, mimeType });
  }
  return files;
}

/** Runs Claude and saves notions, sheets and questions. Never throws: failures are stored on the revision. */
const SCHOOL_LEVELS = new Set(["primaire", "college", "lycee"]);
/** At most this many sub-notions added « from the programme » per revision: the course stays the base. */
const MAX_PROGRAMME_ADDITIONS = 2;

export async function processRevision(revisionId: string, files: ai.CourseFile[], learner: Pick<Learner, "level" | "grade">, hint: { title: string; subject: string }) {
  try {
    const school = SCHOOL_LEVELS.has(learner.level);
    const programme = school ? programmeForPrompt(learner.grade) : null;
    const out = await ai.generateRevision({ files, level: learner.level as Level, grade: learner.grade, hint, programme });
    await saveGenerated(revisionId, out, hint, { school, grade: learner.grade });
    await notifyRevisionReady(revisionId);
  } catch (e) {
    const message = e instanceof ai.CervelleAiError ? e.message : "La préparation a échoué. Réessaie.";
    if (!(e instanceof ai.CervelleAiError)) console.error("Cervelle: revision failed", e);
    await prisma.revision.update({ where: { id: revisionId }, data: { status: "failed", error: message } }).catch(() => {});
  }
}

async function saveGenerated(revisionId: string, out: ai.GeneratedRevision, hint: { title: string; subject: string }, ctx: { school: boolean; grade: string }) {
  const chapter = ctx.school && out.chapitre_programme ? findChapter(ctx.grade, out.chapitre_programme) : null;
  let additions = 0;
  await prisma.$transaction(
    async (tx) => {
      await tx.notion.deleteMany({ where: { revisionId } });
      const sheets: Prisma.InputJsonValue[] = [];
      let questionOrder = 0;
      let kept = 0;
      for (const [i, n] of out.notions.slice(0, 8).entries()) {
        const root = await tx.notion.create({ data: { revisionId, title: n.titre.trim().slice(0, 160) || `Partie ${i + 1}`, order: i } });
        let children = 0;
        for (const [j, sub] of n.sous_notions.slice(0, 6).entries()) {
          // Outside school, or past the cap, nothing is added beyond the photographed course.
          const fromProgramme = sub.origine === "programme";
          if (fromProgramme && (!ctx.school || additions >= MAX_PROGRAMME_ADDITIONS)) continue;
          if (fromProgramme) additions++;
          children++;
          const leaf = await tx.notion.create({ data: { revisionId, parentId: root.id, title: sub.titre.trim().slice(0, 160) || root.title, order: j, fromProgramme } });
          sheets.push({ notionId: leaf.id, parentTitle: root.title, title: leaf.title, fromProgramme, ...ai.cleanSheet(sub.fiche) });
          const questions = sub.questions.map(ai.cleanQuestion).filter((q): q is ai.CleanQuestion => q !== null).slice(0, 8);
          if (questions.length) {
            await tx.question.createMany({ data: questions.map((q) => ({ ...q, revisionId, notionId: leaf.id, order: questionOrder++ })) });
            kept += questions.length;
          }
        }
        if (children === 0) await tx.notion.delete({ where: { id: root.id } });
      }
      if (kept === 0) throw new ai.CervelleAiError("Je n'ai pas trouvé assez de contenu pour faire des questions. Ajoute d'autres pages du cours.");
      await tx.revision.update({
        where: { id: revisionId },
        data: {
          status: "ready",
          error: null,
          title: hint.title || out.titre.trim().slice(0, 120) || "Révision",
          subject: hint.subject || chapter?.subject.subject || out.matiere.trim().slice(0, 60),
          icon: REVISION_ICONS.includes(out.icone) ? out.icone : "livre",
          summary: out.resume.trim().slice(0, 800),
          sheets,
          programmeChapterId: chapter?.chapter.id ?? null,
        },
      });
    },
    { timeout: 30_000 },
  );
}

cervelleRouter.post("/learners/:learnerId/revisions", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  if (!aiConfigured(res)) return;
  const parsed = createRevisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const files = decodeFiles(parsed.data.files);
  if (typeof files === "string") return res.status(400).json({ error: files });
  const familyId = req.cervelle!.familyId;
  if (!(await underDailyLimit(familyId, "revision", res))) return;

  const { title, subject, examDate } = parsed.data;
  const revision = await prisma.revision.create({
    data: {
      learnerId: learner.id,
      title,
      subject,
      examDate: examDate ? new Date(`${examDate}T00:00:00Z`) : null,
      createdBy: req.cervelle!.kind === "child" ? "enfant" : "parent",
      photoCount: files.length,
    },
  });
  await recordUsage(familyId, "revision");
  const photoKeys = await storeFiles(`cervelle/${familyId}/${revision.id}`, files);
  if (photoKeys.length) await prisma.revision.update({ where: { id: revision.id }, data: { photoKeys } });
  void processRevision(revision.id, files, learner, { title, subject });
  res.status(202).json({ revision: { id: revision.id, status: revision.status } });
});

cervelleRouter.post("/learners/:learnerId/revisions/:revisionId/retry", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  if (!aiConfigured(res)) return;
  const revision = await loadRevision(req, res, learner);
  if (!revision) return;
  if (revision.status !== "failed") return res.status(409).json({ error: "Cette révision n'a pas échoué." });
  const files = await loadStoredFiles(revision.photoKeys);
  if (!files) return res.status(410).json({ error: "Je n'ai plus les photos de ce cours. Ajoute une nouvelle révision avec les photos." });
  if (!(await underDailyLimit(req.cervelle!.familyId, "revision", res))) return;
  await recordUsage(req.cervelle!.familyId, "revision");
  await prisma.revision.update({ where: { id: revision.id }, data: { status: "processing", error: null } });
  void processRevision(revision.id, files, learner, { title: revision.title, subject: revision.subject });
  res.status(202).json({ revision: { id: revision.id, status: "processing" } });
});

const patchRevisionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  subject: z.string().trim().max(60).optional(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

cervelleRouter.patch("/learners/:learnerId/revisions/:revisionId", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revision = await loadRevision(req, res, learner);
  if (!revision) return;
  const parsed = patchRevisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { examDate, ...rest } = parsed.data;
  const updated = await prisma.revision.update({
    where: { id: revision.id },
    data: { ...rest, ...(examDate !== undefined ? { examDate: examDate ? new Date(`${examDate}T00:00:00Z`) : null } : {}) },
  });
  const notions = await prisma.notion.findMany({ where: { revisionId: revision.id }, include: { children: true } });
  res.json({ revision: serializeRevisionDetail(updated, notions, await prisma.question.count({ where: { revisionId: revision.id } })) });
});

cervelleRouter.delete("/learners/:learnerId/revisions/:revisionId", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revision = await loadRevision(req, res, learner);
  if (!revision) return;
  await prisma.revision.delete({ where: { id: revision.id } });
  await removeObjects(revision.photoKeys);
  res.status(204).end();
});

cervelleRouter.get("/learners/:learnerId/revisions/:revisionId/photos", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revision = await loadRevision(req, res, learner);
  if (!revision) return;
  const storage = getStorage();
  const urls = storage ? await Promise.all(revision.photoKeys.map((k, i) => storage.downloadUrl(k, `cours-${i + 1}.${k.split(".").pop()}`))) : [];
  res.json({ photos: urls });
});

// ─── Quiz ────────────────────────────────────────────────────────────────

// « express » : 6 questions d'une révision, les notions À revoir d'abord (veille d'interro).
export const QUIZ_MODES = ["qcm", "cartes", "interro", "a_revoir", "express"] as const;
type QuizMode = (typeof QUIZ_MODES)[number];

function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** What the app shows: never the answer, except the back of a flash card (in « cartes », every question is a card). */
function playable(q: Question & { notion: Notion }, mode: QuizMode) {
  const base = { id: q.id, type: q.type, prompt: q.prompt, notionId: q.notionId, notionTitle: q.notion.title };
  switch (q.type) {
    case "qcm":
      return { ...base, choices: q.choices };
    case "ordre":
      return { ...base, items: shuffle(q.items) };
    case "carte":
      return { ...base, back: q.answer };
    default:
      return mode === "cartes" ? { ...base, back: q.type === "trous" ? q.prompt.replace(/_{3,}/, q.answer) : q.answer } : base;
  }
}

/** Questions of weaker notions first, one per notion before a second one. */
function pickSpread(questions: (Question & { notion: Notion })[], count: number, now: Date) {
  const rank: Record<Mastery, number> = { review: 0, new: 1, mastered: 2 };
  const byNotion = new Map<string, (Question & { notion: Notion })[]>();
  for (const q of shuffle(questions)) byNotion.set(q.notionId, [...(byNotion.get(q.notionId) ?? []), q]);
  const groups = [...byNotion.values()].sort((a, b) => rank[labelOf(a[0].notion, now)] - rank[labelOf(b[0].notion, now)]);
  const out: (Question & { notion: Notion })[] = [];
  while (out.length < count && groups.some((g) => g.length)) {
    for (const g of groups) {
      const q = g.shift();
      if (q) out.push(q);
      if (out.length === count) break;
    }
  }
  return shuffle(out);
}

cervelleRouter.get("/learners/:learnerId/quiz", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const mode = String(req.query.mode ?? "qcm") as QuizMode;
  if (!QUIZ_MODES.includes(mode)) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
  const revisionId = typeof req.query.revisionId === "string" ? req.query.revisionId : null;
  if (!revisionId && mode !== "a_revoir") return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
  if (revisionId && !(await prisma.revision.findFirst({ where: { id: revisionId, learnerId: learner.id, status: "ready" } }))) {
    return res.status(404).json({ error: "Révision introuvable" });
  }
  const now = new Date();
  const scope: Prisma.QuestionWhereInput = revisionId ? { revisionId } : { revision: { learnerId: learner.id, status: "ready" } };
  const types: Record<QuizMode, string[] | null> = { qcm: ["qcm", "vrai_faux"], cartes: ["carte", "courte", "trous"], interro: null, a_revoir: null, express: null };
  const all = await prisma.question.findMany({ where: { ...scope, ...(types[mode] ? { type: { in: types[mode]! } } : {}) }, include: { notion: true } });

  let picked: (Question & { notion: Notion })[];
  if (mode === "a_revoir") {
    picked = pickSpread(all.filter((q) => labelOf(q.notion, now) === "review"), 12, now);
  } else if (mode === "cartes") {
    picked = pickSpread(all, 20, now);
  } else if (mode === "express") {
    picked = pickSpread(all, 6, now);
  } else {
    picked = pickSpread(all, mode === "interro" ? 15 : 10, now);
  }
  res.json({ mode, revisionId, questions: picked.map((q) => playable(q, mode)) });
});

const answerSchema = z.object({
  questionId: z.string(),
  mode: z.enum(QUIZ_MODES),
  // qcm: index; vrai_faux: "vrai"/"faux"; carte: "su"/"pas_su"; ordre: the items in the child's order; others: text.
  answer: z.union([z.string().max(1000), z.array(z.string().max(300)).max(10)]),
});

function expectedText(q: Question): string {
  if (q.type === "qcm") return q.choices[Number(q.answer)] ?? "";
  if (q.type === "vrai_faux") return q.answer === "vrai" ? "Vrai" : "Faux";
  if (q.type === "ordre") return q.items.join(" → ");
  return q.answer;
}

cervelleRouter.post("/learners/:learnerId/answers", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { questionId, mode, answer } = parsed.data;
  const question = await prisma.question.findFirst({ where: { id: questionId, revision: { learnerId: learner.id } }, include: { notion: true } });
  if (!question) return res.status(404).json({ error: "Question introuvable" });

  const text = Array.isArray(answer) ? answer.join(" | ") : answer;
  let correct: boolean;
  let comment = "";
  switch (question.type) {
    case "qcm":
      correct = text.trim() === question.answer;
      break;
    case "vrai_faux":
      correct = normalizeAnswer(text) === question.answer;
      break;
    case "carte":
      correct = text === "su";
      break;
    case "ordre":
      correct = Array.isArray(answer) && sameOrder(answer, question.items);
      break;
    default: {
      // In card mode the child grades themself; elsewhere check the typed answer.
      if (mode === "cartes" && (text === "su" || text === "pas_su")) {
        correct = text === "su";
        break;
      }
      const local = localGrade(text, [question.answer, ...question.acceptable]);
      if (local !== null) {
        correct = local;
        break;
      }
      const familyId = req.cervelle!.familyId;
      correct = false;
      comment = "Ta réponse ne correspond pas à celle attendue.";
      if (isMealAiConfigured() && (await usedToday(familyId, "grading")) < DAILY_LIMITS.grading) {
        await recordUsage(familyId, "grading");
        try {
          const verdict = await ai.gradeAnswer({ question: question.prompt, expected: question.answer, acceptable: question.acceptable, answer: text, level: learner.level as Level });
          if (verdict) {
            correct = verdict.correct;
            comment = verdict.comment;
          }
        } catch (e) {
          if (!(e instanceof ai.CervelleAiError)) throw e;
        }
      }
    }
  }

  const now = new Date();
  const today = parisDay(now);
  const alreadyRightToday = correct
    ? (await prisma.attempt.findMany({ where: { learnerId: learner.id, questionId, correct: true, createdAt: { gte: beforeParisDay(today) } }, select: { createdAt: true } })).filter(
        (a) => parisDay(a.createdAt) === today,
      ).length
    : 0;
  const coins = correct && alreadyRightToday === 0 ? COINS_PER_RIGHT_ANSWER : 0;
  const xp = correct ? XP_PER_RIGHT_ANSWER : XP_PER_ANSWER;
  const next = applyAnswer(question.notion, correct, now);

  const [, notion, updatedLearner] = await prisma.$transaction([
    prisma.attempt.create({ data: { learnerId: learner.id, questionId, correct, answer: text.slice(0, 1000), mode } }),
    prisma.notion.update({ where: { id: question.notionId }, data: next }),
    prisma.learner.update({ where: { id: learner.id }, data: { coins: { increment: coins }, xp: { increment: xp } } }),
  ]);
  const before = levelOf(learner.xp).level;
  const after = levelOf(updatedLearner.xp);
  res.json({
    correct,
    expected: expectedText(question),
    explanation: question.explanation,
    comment,
    mastery: labelOf(notion, now),
    coins,
    xp,
    levelUp: after.level > before ? after : null,
  });
});

const sessionSchema = z.object({
  revisionId: z.string().nullable().optional(),
  mode: z.enum(["fiches", ...QUIZ_MODES]),
  seconds: z.number().int().min(0).max(4 * 3600),
  correct: z.number().int().min(0).max(200).default(0),
  total: z.number().int().min(0).max(200).default(0),
});

/** End of a study session: time, best scores, streak, coins, missions. */
cervelleRouter.post("/learners/:learnerId/sessions", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  if (d.correct > d.total) return res.status(400).json({ error: "Ça n'a pas marché. Réessaie dans un instant." });
  const revision = d.revisionId ? await prisma.revision.findFirst({ where: { id: d.revisionId, learnerId: learner.id } }) : null;
  if (d.revisionId && !revision) return res.status(404).json({ error: "Révision introuvable" });

  const today = parisDay();
  const percent = d.total > 0 ? Math.round((d.correct / d.total) * 100) : null;
  let coins = 0;
  const revisionData: Prisma.RevisionUpdateInput = {};
  if (d.mode === "fiches") {
    if (revision && !(revision.sheetsReadAt && parisDay(revision.sheetsReadAt) === today)) coins += COINS_SHEETS_READ;
    revisionData.sheetsReadAt = new Date();
  } else if (d.total >= 3) {
    coins += COINS_PER_SESSION;
    if (d.mode === "interro" && percent !== null && percent >= 80) coins += COINS_GREAT_EXAM;
    if (percent !== null && (d.mode === "qcm" || d.mode === "cartes") && (revision?.quizBest ?? -1) < percent) revisionData.quizBest = percent;
    if (percent !== null && d.mode === "interro" && (revision?.examBest ?? -1) < percent) revisionData.examBest = percent;
  }
  const streak = nextStreak(learner.lastStudyDay, learner.streak, today);

  const [session, updated] = await prisma.$transaction([
    prisma.studySession.create({ data: { learnerId: learner.id, revisionId: revision?.id ?? null, mode: d.mode, seconds: d.seconds, correct: d.correct, total: d.total, coins, day: today } }),
    prisma.learner.update({
      where: { id: learner.id },
      data: { coins: { increment: coins }, streak, bestStreak: Math.max(learner.bestStreak, streak), lastStudyDay: today },
    }),
    ...(revision && Object.keys(revisionData).length ? [prisma.revision.update({ where: { id: revision.id }, data: revisionData })] : []),
  ]);
  res.status(201).json({
    session: { id: session.id, coins, percent, score20: d.mode === "interro" && percent !== null ? Math.round(percent / 5) : null },
    learner: serializeLearner(updated),
    streakIncreased: streak > currentStreak(learner.lastStudyDay, learner.streak, today),
    missions: await missionState(updated),
  });
});

// ─── Home, missions, shop ────────────────────────────────────────────────

export async function missionState(learner: Learner) {
  const today = parisDay();
  const since = beforeParisDay(today);
  const [sessions, answers, habits, todos, journal, ready] = await Promise.all([
    prisma.studySession.findMany({ where: { learnerId: learner.id, day: today }, select: { mode: true, correct: true, total: true, seconds: true } }),
    prisma.attempt.findMany({ where: { learnerId: learner.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.habit.findMany({ where: { learnerId: learner.id, archivedAt: null }, select: { days: true, createdAt: true, checks: { where: { day: today }, select: { id: true } } } }),
    prisma.todoItem.findMany({ where: { learnerId: learner.id, OR: [{ doneAt: null }, { doneAt: { gte: since } }, { createdAt: { gte: since } }] }, select: { doneAt: true, createdAt: true } }),
    prisma.journalEntry.count({ where: { learnerId: learner.id, day: today } }),
    prisma.revision.count({ where: { learnerId: learner.id, status: "ready" } }),
  ]);
  const answersToday = answers.filter((a) => parisDay(a.createdAt) === today).length;
  const weekday = weekdayOf(today);
  const before = (d: Date) => parisDay(d) < today;
  const m = missions(
    {
      sessions,
      answersToday,
      focusMinutes: Math.floor(sessions.filter((x) => x.mode === "minuteur").reduce((n, x) => n + x.seconds, 0) / 60),
      habitsChecked: habits.filter((h) => h.checks.length > 0).length,
      habitsPlanned: habits.filter((h) => h.days.includes(weekday) && before(h.createdAt)).length,
      todosDoneToday: todos.filter((t) => t.doneAt && parisDay(t.doneAt) === today).length,
      todosAddedToday: todos.filter((t) => parisDay(t.createdAt) === today).length,
      todosOpen: todos.filter((t) => before(t.createdAt) && (!t.doneAt || parisDay(t.doneAt) === today)).length,
      journalToday: journal > 0,
      hasRevisions: ready > 0,
      focusTarget: learner.focusMinutes ?? timerDefaults(learner.level).focus,
    },
    `${learner.id}:${today}`,
  );
  return { ...m, chestOpened: learner.chestDay === today, chestCoins: CHEST_COINS };
}

cervelleRouter.get("/learners/:learnerId/home", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const revisions = await revisionCards(learner.id);
  const dueReview = revisions.reduce((n, r) => n + r.counts.review, 0);
  res.json({ learner: serializeLearner(learner), missions: await missionState(learner), revisions, dueReview });
});

cervelleRouter.post("/learners/:learnerId/chest", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const state = await missionState(learner);
  if (state.chestOpened) return res.status(409).json({ error: "Coffre déjà ouvert aujourd'hui. Reviens demain !" });
  if (state.done < state.total) return res.status(400).json({ error: "Termine les missions du jour pour ouvrir le coffre." });
  const today = parisDay();
  // Conditional update: two taps at once can't open it twice.
  const opened = await prisma.learner.updateMany({
    where: { id: learner.id, OR: [{ chestDay: null }, { chestDay: { not: today } }] },
    data: { chestDay: today, coins: { increment: CHEST_COINS } },
  });
  if (opened.count === 0) return res.status(409).json({ error: "Coffre déjà ouvert aujourd'hui. Reviens demain !" });
  const updated = await prisma.learner.findUniqueOrThrow({ where: { id: learner.id } });
  res.json({ coins: CHEST_COINS, learner: serializeLearner(updated) });
});

cervelleRouter.get("/learners/:learnerId/shop", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  res.json({
    coins: learner.coins,
    items: SHOP.map((i) => ({ ...i, owned: learner.owned.includes(i.id), equipped: learner.equipped.includes(i.id) })),
  });
});

cervelleRouter.post("/learners/:learnerId/shop/:itemId/buy", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const item = shopItem(String(req.params.itemId));
  if (!item) return res.status(404).json({ error: "Objet introuvable" });
  if (learner.owned.includes(item.id)) return res.status(409).json({ error: "Tu l'as déjà !" });
  // Conditional update so the coins can't go below zero with two taps at once.
  const bought = await prisma.learner.updateMany({
    where: { id: learner.id, coins: { gte: item.price }, NOT: { owned: { has: item.id } } },
    data: { coins: { decrement: item.price }, owned: { push: item.id } },
  });
  if (bought.count === 0) return res.status(400).json({ error: `Il te faut ${item.price} pièces.` });
  const after = await prisma.learner.findUniqueOrThrow({ where: { id: learner.id } });
  const updated = await prisma.learner.update({ where: { id: learner.id }, data: { equipped: equip(after.equipped, item.id) } });
  res.json({ learner: serializeLearner(updated) });
});

cervelleRouter.post("/learners/:learnerId/shop/:itemId/equip", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const id = String(req.params.itemId);
  if (!learner.owned.includes(id)) return res.status(400).json({ error: "Achète-le d'abord." });
  const wear = req.body?.on !== false;
  const equipped = wear ? equip(learner.equipped, id) : learner.equipped.filter((e) => e !== id);
  const updated = await prisma.learner.update({ where: { id: learner.id }, data: { equipped } });
  res.json({ learner: serializeLearner(updated) });
});

// ─── Assistant ───────────────────────────────────────────────────────────

const assistantSchema = z.object({
  revisionId: z.string().nullable().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(30),
});

function courseText(r: Revision): string {
  const sheets = (Array.isArray(r.sheets) ? r.sheets : []) as { title?: string; essentiel?: string; points?: string[]; retenir?: string }[];
  const body = sheets.map((s) => `## ${s.title ?? ""}\n${s.essentiel ?? ""}\n${(s.points ?? []).map((p) => `- ${p}`).join("\n")}\nÀ retenir : ${s.retenir ?? ""}`).join("\n\n");
  return `# ${r.title} (${r.subject})\n${r.summary}\n\n${body}`.slice(0, 20_000);
}

cervelleRouter.post("/learners/:learnerId/assistant", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  if (!aiConfigured(res)) return;
  const parsed = assistantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { revisionId, messages } = parsed.data;
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "La conversation doit finir par ta question." });
  const revision = revisionId ? await prisma.revision.findFirst({ where: { id: revisionId, learnerId: learner.id, status: "ready" } }) : null;
  const familyId = req.cervelle!.familyId;
  if (!(await underDailyLimit(familyId, "assistant", res))) return;
  await recordUsage(familyId, "assistant");
  try {
    const reply = await ai.assistantReply({ level: learner.level as Level, grade: learner.grade, course: revision ? courseText(revision) : null, turns: messages.slice(-12) });
    res.json({ reply });
  } catch (e) {
    if (e instanceof ai.CervelleAiError) return res.status(502).json({ error: e.message });
    throw e;
  }
});

// ─── Corrected tests ─────────────────────────────────────────────────────

const examSchema = z.object({
  files: z.array(fileSchema).min(1, "Ajoute au moins une photo de la copie").max(MAX_FILES),
  revisionId: z.string().nullable().optional(),
});

function serializeExam(e: { id: string; status: string; error: string | null; analysis: unknown; revisionId: string | null; createdAt: Date; revision?: { title: string } | null }) {
  return { id: e.id, status: e.status, error: e.error, analysis: e.analysis ?? null, revisionId: e.revisionId, revisionTitle: e.revision?.title ?? null, createdAt: e.createdAt.toISOString() };
}

export async function processExam(examId: string, files: ai.CourseFile[], learner: Pick<Learner, "level" | "grade">, revisionId: string | null) {
  try {
    const notions = revisionId ? leaves(await prisma.notion.findMany({ where: { revisionId } })).map((n) => ({ id: n.id, title: n.title })) : [];
    const analysis = await ai.analyzeExam({ files, level: learner.level as Level, grade: learner.grade, notions });
    const toReview = [...new Set(analysis.erreurs.map((e) => e.notion_id).filter(Boolean))];
    await prisma.$transaction([
      prisma.examReview.update({ where: { id: examId }, data: { status: "ready", error: null, analysis } }),
      // The teacher saw a mistake on these notions: back to « À revoir ».
      prisma.notion.updateMany({ where: { id: { in: toReview }, revisionId: revisionId ?? undefined }, data: { mastery: "review", streak: 0, nextReviewAt: new Date() } }),
    ]);
  } catch (e) {
    const message = e instanceof ai.CervelleAiError ? e.message : "L'analyse a échoué. Réessaie.";
    if (!(e instanceof ai.CervelleAiError)) console.error("Cervelle: exam analysis failed", e);
    await prisma.examReview.update({ where: { id: examId }, data: { status: "failed", error: message } }).catch(() => {});
  }
}

cervelleRouter.post("/learners/:learnerId/exam-reviews", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  if (!aiConfigured(res)) return;
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const files = decodeFiles(parsed.data.files);
  if (typeof files === "string") return res.status(400).json({ error: files });
  const revisionId = parsed.data.revisionId ?? null;
  if (revisionId && !(await prisma.revision.findFirst({ where: { id: revisionId, learnerId: learner.id } }))) return res.status(404).json({ error: "Révision introuvable" });
  const familyId = req.cervelle!.familyId;
  if (!(await underDailyLimit(familyId, "exam", res))) return;
  const exam = await prisma.examReview.create({ data: { learnerId: learner.id, revisionId } });
  await recordUsage(familyId, "exam");
  const photoKeys = await storeFiles(`cervelle/${familyId}/interro-${exam.id}`, files);
  if (photoKeys.length) await prisma.examReview.update({ where: { id: exam.id }, data: { photoKeys } });
  void processExam(exam.id, files, learner, revisionId);
  res.status(202).json({ examReview: serializeExam(exam) });
});

cervelleRouter.get("/learners/:learnerId/exam-reviews", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const exams = await prisma.examReview.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "desc" }, take: 30, include: { revision: { select: { title: true } } } });
  res.json({ examReviews: exams.map(serializeExam) });
});

cervelleRouter.get("/learners/:learnerId/exam-reviews/:examId", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  let exam = await prisma.examReview.findFirst({ where: { id: String(req.params.examId), learnerId: learner.id }, include: { revision: { select: { title: true } } } });
  if (!exam) return res.status(404).json({ error: "Analyse introuvable" });
  if (exam.status === "processing" && Date.now() - exam.createdAt.getTime() > PROCESSING_TIMEOUT_MS) {
    exam = await prisma.examReview.update({ where: { id: exam.id }, data: { status: "failed", error: "L'analyse a été interrompue. Renvoie les photos." }, include: { revision: { select: { title: true } } } });
  }
  res.json({ examReview: serializeExam(exam) });
});

cervelleRouter.delete("/learners/:learnerId/exam-reviews/:examId", async (req, res) => {
  const learner = await loadLearner(req, res);
  if (!learner) return;
  const exam = await prisma.examReview.findFirst({ where: { id: String(req.params.examId), learnerId: learner.id } });
  if (!exam) return res.status(404).json({ error: "Analyse introuvable" });
  await prisma.examReview.delete({ where: { id: exam.id } });
  await removeObjects(exam.photoKeys);
  res.status(204).end();
});

// Agenda, tâches, habitudes, journal, minuteur, statistiques et amis.
mountOrganize(cervelleRouter, { loadLearner, parentOnly, serializeLearner, missionState, underDailyLimit, recordUsage, aiConfigured, decodeFiles });
