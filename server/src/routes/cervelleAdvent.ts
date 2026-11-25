import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { parisDay } from "../lib/cervelle/days";
import { ADVENT, adventCells, adventPhase, adventYear, daysUntilStart, keysOf, keyWindow, type AdventReward } from "../lib/cervelle/advent";
import { equip, shopItem } from "../lib/cervelle/shop";

// Calendrier de l'Avent (src/lib/cervelle/advent.ts) : GET montre les cases,
// POST …/:day/open en ouvre une (StarEvent « avent:YYYY:D », une seule fois).

const keyOf = (year: number, day: number) => `avent:${year}:${day}`;

function rewardView(r: AdventReward) {
  if (r.type === "item") return { type: r.type, item: r.item, itemName: shopItem(r.item)?.name ?? r.item, stars: 0, text: null };
  if (r.type === "stars") return { type: r.type, item: null, itemName: null, stars: r.stars, text: null };
  return { type: r.type, item: null, itemName: null, stars: r.stars, text: r.text };
}

async function state(learner: Learner, today: string) {
  const year = adventYear(today);
  if (year === null) return null;
  const { from, to } = keyWindow(year);
  const [sessions, events] = await Promise.all([
    prisma.studySession.groupBy({ by: ["day"], where: { learnerId: learner.id, total: { gt: 0 }, day: { gte: from, lte: to } }, _count: { _all: true } }),
    prisma.starEvent.findMany({ where: { learnerId: learner.id, key: { startsWith: `avent:${year}:` } } }),
  ]);
  const byDay = Object.fromEntries(sessions.map((s) => [s.day, s._count._all]));
  const opened = new Set(events.map((e) => Number(e.key.split(":")[2])));
  const keys = keysOf(byDay, year, today);
  const cells = adventCells(year, today, opened, keys);
  const todayCell = cells.find((c) => c.date === today) ?? null;
  return {
    year,
    phase: adventPhase(year, today),
    daysUntil: daysUntilStart(year, today),
    keys,
    keysLeft: Math.max(0, keys - opened.size),
    revisedToday: (byDay[today] ?? 0) > 0,
    today: todayCell?.day ?? null,
    cells: cells.map((c) => ({ ...c, reward: c.opened ? rewardView(ADVENT[c.day - 1]) : null })),
  };
}

export function mountAdvent(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null>; serializeLearner: (l: Learner) => unknown }) {
  router.get("/learners/:learnerId/advent", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    res.json({ advent: await state(learner, parisDay()) });
  });

  router.post("/learners/:learnerId/advent/:day/open", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const today = parisDay();
    const s = await state(learner, today);
    if (!s) return res.status(400).json({ error: "Le calendrier de l'Avent revient en décembre." });
    const cell = s.cells.find((c) => c.day === Number(req.params.day));
    if (!cell) return res.status(404).json({ error: "Cette case n'existe pas." });
    if (cell.opened) return res.status(409).json({ error: "Tu l'as déjà ouverte !" });
    if (!cell.arrived) return res.status(400).json({ error: s.phase === "bientot" ? "Patience : le calendrier commence le 1er décembre." : `Patience : cette case s'ouvre le ${cell.day} décembre.` });
    if (!cell.openable) {
      return res.status(400).json({ error: s.revisedToday ? "Fais encore une révision aujourd'hui pour rattraper cette case." : "Fais une petite révision pour ouvrir la case." });
    }
    const reward = ADVENT[cell.day - 1];
    const item = reward.type === "item" ? reward.item : null;
    try {
      await prisma.$transaction([
        prisma.starEvent.create({ data: { learnerId: learner.id, key: keyOf(s.year, cell.day), day: today, stars: reward.type === "item" ? 0 : reward.stars, item } }),
        ...(item
          ? [
              // Un accessoire se porte tout de suite : l'enfant le voit sur Cervelle.
              prisma.learner.update({
                where: { id: learner.id },
                data: { equipped: equip(learner.equipped, item), ...(!learner.owned.includes(item) ? { owned: { push: item } } : {}) },
              }),
            ]
          : []),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return res.status(409).json({ error: "Tu l'as déjà ouverte !" });
      throw e;
    }
    const after = await prisma.learner.findUniqueOrThrow({ where: { id: learner.id } });
    res.json({ opened: { day: cell.day, reward: rewardView(reward) }, advent: await state(after, today), learner: d.serializeLearner(after) });
  });
}
