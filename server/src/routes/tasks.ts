import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { dateForWeekday, mondayOfWeek } from "../lib/dates";
import { Constraints, getProposals, SchedulableTask, Weekday } from "../lib/scheduling";
import { syncTaskToCalendar, unsyncTaskFromCalendar } from "../services/calendarSync";
import type { Task } from "@prisma/client";
import { patchSchema } from "../lib/validation";
import { isMondayKey } from "../lib/stars";

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

type TaskWithMembers = Task & { members: { memberId: string }[] };

function serializeTask(task: TaskWithMembers) {
  return {
    id: task.id,
    title: task.title,
    category: task.category,
    weekday: task.weekday,
    date: task.date.toISOString(),
    time: task.time,
    duration: task.duration,
    priority: task.priority,
    deadlineWeekday: task.deadlineWeekday,
    recurring: task.recurring,
    reminder: task.reminder,
    flexible: task.flexible,
    synced: task.synced,
    notes: task.notes,
    memberIds: task.members.map((m) => m.memberId),
    externalProvider: task.externalProvider,
    seriesId: task.seriesId,
    stars: task.stars,
    inDigest: task.inDigest,
    appointmentDate: task.appointmentDate,
    location: task.location,
    remind: task.remind,
  };
}

const include = { members: { select: { memberId: true } } } as const;

tasksRouter.get("/", async (req, res) => {
  const tasks = await prisma.task.findMany({ where: { userId: req.userId }, include, orderBy: [{ weekday: "asc" }, { time: "asc" }] });
  res.json({ tasks: tasks.map(serializeTask) });
});

const taskSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["École", "Travail", "Maison", "Santé", "Loisirs"]),
  weekday: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().min(5).max(480).default(30),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  deadlineWeekday: z.number().int().min(0).max(6).nullable().optional(),
  recurring: z.boolean().default(false),
  reminder: z.boolean().default(false),
  flexible: z.boolean().default(false),
  synced: z.boolean().default(false),
  notes: z.string().default(""),
  memberIds: z.array(z.string()).default([]),
  stars: z.number().int().min(0).max(5).default(1),
  inDigest: z.boolean().default(true),
  // Généré par l'appli (elle doit pouvoir créer une série hors connexion).
  seriesId: z.string().min(8).max(40).regex(/^[A-Za-z0-9_-]+$/).nullable().optional(),
  // Rendez-vous : date précise ; le jour de la semaine en est déduit.
  appointmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d, "Date invalide")
    .nullable()
    .optional(),
  location: z.string().max(200).default(""),
  remind: z.enum(["hour", "eve"]).nullable().optional(),
});

/** Jour de la semaine (0 = lundi) et date stockée d'un rendez-vous. */
function appointmentFields(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return { weekday: (date.getUTCDay() + 6) % 7, date, recurring: false, flexible: false };
}

async function loadOwnedTask(userId: string, id: string) {
  return prisma.task.findFirst({ where: { id, userId }, include });
}

/** Un enfant ne modifie ou supprime que les tâches qui le concernent. */
function childCannotEdit(req: import("express").Request, task: TaskWithMembers): boolean {
  return req.familyRole === "child" && !task.members.some((m) => m.memberId === req.childMemberId);
}
const CHILD_EDIT_ERROR = { error: "Tu peux modifier seulement les tâches où tu es indiqué. Demande à un parent.", code: "child_forbidden" };

async function applyCalendarSideEffects(task: Task) {
  if (task.synced) {
    const { externalEventId, externalProvider } = await syncTaskToCalendar(task);
    if (externalEventId) {
      return prisma.task.update({ where: { id: task.id }, data: { externalEventId, externalProvider }, include });
    }
  } else if (task.externalEventId) {
    await unsyncTaskFromCalendar(task);
    return prisma.task.update({ where: { id: task.id }, data: { externalEventId: null, externalProvider: null }, include });
  }
  return prisma.task.findUniqueOrThrow({ where: { id: task.id }, include });
}

tasksRouter.post("/", async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;

  const task = await prisma.task.create({
    data: {
      userId: req.userId!,
      title: d.title,
      category: d.category,
      weekday: d.weekday,
      date: dateForWeekday(d.weekday as Weekday),
      time: d.time,
      duration: d.duration,
      priority: d.priority,
      deadlineWeekday: d.deadlineWeekday ?? null,
      recurring: d.recurring,
      reminder: d.reminder,
      flexible: d.flexible,
      synced: d.synced,
      notes: d.notes,
      seriesId: d.seriesId ?? null,
      stars: d.stars,
      inDigest: d.inDigest,
      location: d.location,
      remind: d.appointmentDate ? (d.remind ?? null) : null,
      appointmentDate: d.appointmentDate ?? null,
      ...(d.appointmentDate ? appointmentFields(d.appointmentDate) : {}),
      members: { create: d.memberIds.map((memberId) => ({ memberId })) },
    },
    include,
  });

  let final = task;
  try {
    final = (await applyCalendarSideEffects(task)) as TaskWithMembers;
  } catch (e) {
    console.error("Calendar sync failed on create:", e);
  }
  res.status(201).json({ task: serializeTask(final) });
});

tasksRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(taskSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedTask(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (childCannotEdit(req, existing)) return res.status(403).json(CHILD_EDIT_ERROR);
  const d = parsed.data;

  const { memberIds, ...rest } = d;
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...rest,
      date: d.weekday !== undefined ? dateForWeekday(d.weekday as Weekday) : undefined,
      ...(d.appointmentDate ? appointmentFields(d.appointmentDate) : {}),
      ...(memberIds ? { members: { deleteMany: {}, create: memberIds.map((memberId) => ({ memberId })) } } : {}),
    },
    include,
  });

  let final = task;
  try {
    final = (await applyCalendarSideEffects(task)) as TaskWithMembers;
  } catch (e) {
    console.error("Calendar sync failed on update:", e);
  }
  res.json({ task: serializeTask(final) });
});

// « Fait » : une tâche cochée un jour donné. GET renvoie les coches d'une
// semaine (lundi « AAAA-MM-JJ ») ; PUT et DELETE cochent / décochent un jour.
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => {
  const t = new Date(`${d}T12:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}, "Jour invalide");

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

tasksRouter.get("/done", async (req, res) => {
  const week = typeof req.query.week === "string" ? req.query.week : "";
  if (!isMondayKey(week)) return res.status(400).json({ error: "Semaine invalide" });
  const rows = await prisma.taskDone.findMany({
    where: { task: { userId: req.userId! }, day: { gte: week, lte: addDays(week, 6) } },
    select: { taskId: true, day: true },
  });
  res.json({ done: rows });
});

tasksRouter.put("/:id/done", async (req, res) => {
  const parsed = z.object({ day: dayKey }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Jour invalide" });
  const task = await loadOwnedTask(req.userId!, req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  await prisma.taskDone.upsert({
    where: { taskId_day: { taskId: task.id, day: parsed.data.day } },
    create: { taskId: task.id, day: parsed.data.day },
    update: {},
  });
  res.status(204).end();
});

tasksRouter.delete("/:id/done", async (req, res) => {
  const parsed = dayKey.safeParse(req.query.day);
  if (!parsed.success) return res.status(400).json({ error: "Jour invalide" });
  const task = await loadOwnedTask(req.userId!, req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });
  await prisma.taskDone.deleteMany({ where: { taskId: task.id, day: parsed.data } });
  res.status(204).end();
});

tasksRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedTask(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (childCannotEdit(req, existing)) return res.status(403).json(CHILD_EDIT_ERROR);
  try {
    await unsyncTaskFromCalendar(existing);
  } catch (e) {
    console.error("Calendar unsync failed on delete:", e);
  }
  await prisma.task.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const autoSlotSchema = z.object({
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  deadlineWeekday: z.number().int().min(0).max(6).nullable().optional(),
  memberIds: z.array(z.string()).default([]),
  duration: z.number().int().min(1).max(24 * 60).optional(),
});

/** Les rendez-vous d'une autre semaine ne gênent pas le placement de cette semaine. */
function notOtherWeeks() {
  const monday = mondayOfWeek(new Date());
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { OR: [{ appointmentDate: null }, { appointmentDate: { gte: key(monday), lte: key(sunday) } }] };
}

/** Plages de la famille + horaires de travail du compte qui demande. */
async function schedulingConstraints(familyId: string, accountId: string): Promise<Constraints | null> {
  const [family, account] = await Promise.all([
    prisma.constraints.findUnique({ where: { userId: familyId } }),
    prisma.user.findUnique({ where: { id: accountId }, select: { workDays: true, workStart: true, workEnd: true } }),
  ]);
  if (!family) return null;
  return { ...family, work: account ? { days: account.workDays, start: account.workStart, end: account.workEnd } : null };
}

// Called when a task is created with no day picked: reuses the same scoring
// engine as "Replanifier ma semaine" to pick the single best slot up front,
// against a draft task that doesn't exist in the DB yet.
tasksRouter.post("/auto-slot", async (req, res) => {
  const parsed = autoSlotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;

  const [tasks, constraints] = await Promise.all([
    prisma.task.findMany({ where: { userId: req.userId, ...notOtherWeeks() }, include }),
    schedulingConstraints(req.userId!, req.accountId ?? req.userId!),
  ]);
  if (!constraints) return res.status(400).json({ error: "Constraints not set up" });

  const schedulable: SchedulableTask[] = tasks.map((t) => ({
    id: t.id,
    weekday: t.weekday as Weekday,
    time: t.time,
    priority: t.priority as SchedulableTask["priority"],
    deadlineWeekday: (t.deadlineWeekday ?? null) as Weekday | null,
    memberIds: t.members.map((m) => m.memberId),
    duration: t.duration,
  }));

  const draft: SchedulableTask = {
    id: "__draft__",
    weekday: 0,
    time: "09:00",
    priority: d.priority,
    deadlineWeekday: (d.deadlineWeekday ?? null) as Weekday | null,
    memberIds: d.memberIds,
    duration: d.duration,
  };

  const [best] = getProposals(draft, schedulable, constraints, 1);
  if (!best) return res.status(422).json({ error: "Aucun créneau disponible cette semaine." });
  res.json({ weekday: best.weekday, time: best.time, reasons: best.reasons });
});

// "Replanifier ma semaine" — top-3 scored slot proposals for every flexible task.
tasksRouter.get("/replan/proposals", async (req, res) => {
  const [tasks, constraints] = await Promise.all([
    prisma.task.findMany({ where: { userId: req.userId, ...notOtherWeeks() }, include }),
    schedulingConstraints(req.userId!, req.accountId ?? req.userId!),
  ]);
  if (!constraints) return res.status(400).json({ error: "Constraints not set up" });

  const schedulable: SchedulableTask[] = tasks.map((t) => ({
    id: t.id,
    weekday: t.weekday as Weekday,
    time: t.time,
    priority: t.priority as SchedulableTask["priority"],
    deadlineWeekday: (t.deadlineWeekday ?? null) as Weekday | null,
    memberIds: t.members.map((m) => m.memberId),
    duration: t.duration,
  }));

  const flexible = tasks.filter((t) => t.flexible);
  const proposals = flexible.map((t) => {
    const schedulableTask = schedulable.find((s) => s.id === t.id)!;
    // Plusieurs heures par jour, pour laisser le choix.
    const candidates = getProposals(schedulableTask, schedulable, constraints, 6, 2);
    return { taskId: t.id, title: t.title, currentWeekday: t.weekday, currentTime: t.time, candidates };
  });

  res.json({ proposals: proposals.filter((p) => p.candidates.length > 0) });
});
