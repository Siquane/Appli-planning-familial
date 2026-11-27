import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { isMealAiConfigured } from "../env";
import { addDays, parisDay, weekdayOf } from "../lib/cervelle/days";
import { OutingsError, geocode, proposeIdeas, weatherOn } from "../services/outings";

// « Sorties & idées » (onglet Planning) : 5 idées d'activités en famille pour
// ce soir ou un jour des deux prochaines semaines, selon la météo, le temps
// libre et l'âge des enfants. Une idée choisie devient un rendez-vous (route
// /tasks habituelle, côté appli).

export const outingsRouter = Router();
outingsRouter.use(requireAuth);

/** Demandes d'idées par famille et par 24 h. */
export const OUTINGS_DAILY_LIMIT = 15;
const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const ideasSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  moment: z.enum(["soir", "journee"]),
  city: z.string().trim().max(80).optional(),
  exclude: z.array(z.string().max(80)).max(20).default([]),
});

outingsRouter.get("/settings", async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { outingCity: true } });
  res.json({ city: u?.outingCity ?? null });
});

outingsRouter.post("/ideas", async (req, res) => {
  const parsed = ideasSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { day, moment, exclude } = parsed.data;
  const today = parisDay();
  if (day < today || day > addDays(today, 14)) return res.status(400).json({ error: "Choisis un jour dans les deux prochaines semaines." });
  if (!isMealAiConfigured()) return res.status(503).json({ error: "Les idées ne sont pas disponibles pour le moment. Réessaie plus tard." });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await prisma.aiUsage.count({ where: { userId: req.userId!, kind: "sorties", createdAt: { gte: since } } })) >= OUTINGS_DAILY_LIMIT) {
    return res.status(429).json({ error: "Assez d'idées pour aujourd'hui ! Reviens demain." });
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { outingCity: true } });
  const city = parsed.data.city !== undefined ? parsed.data.city || null : (user?.outingCity ?? null);
  if (parsed.data.city !== undefined && city !== user?.outingCity) await prisma.user.update({ where: { id: req.userId }, data: { outingCity: city } });

  try {
    const place = city ? await geocode(city) : null;
    if (city && !place) return res.status(400).json({ error: `Ville introuvable : « ${city} ». Vérifie l'orthographe.` });
    const weather = place ? await weatherOn(place, day) : null;
    const wd = weekdayOf(day);
    const [members, tasks] = await Promise.all([
      prisma.familyMember.findMany({ where: { userId: req.userId }, select: { age: true } }),
      prisma.task.findMany({ where: { userId: req.userId, OR: [{ appointmentDate: day }, { appointmentDate: null, weekday: wd }] }, select: { title: true, time: true, duration: true } }),
    ]);
    const busy = tasks
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((t) => {
        const [h, m] = t.time.split(":").map(Number);
        const end = h * 60 + m + t.duration;
        return `${t.time}-${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")} ${t.title}`;
      })
      .slice(0, 20);
    const dayLabel = day === today ? "aujourd'hui" : day === addDays(today, 1) ? "demain" : `${DAYS[wd]} ${Number(day.slice(8))}`;
    const ideas = await proposeIdeas({ dayLabel, moment, city: place?.name ?? null, weather, ages: members.map((m) => m.age), busy, exclude });
    await prisma.aiUsage.create({ data: { userId: req.userId!, kind: "sorties" } });
    res.json({ day, moment, city: place?.name ?? null, weather, ideas, weekday: wd });
  } catch (e) {
    if (e instanceof OutingsError) return res.status(502).json({ error: e.message });
    throw e;
  }
});
