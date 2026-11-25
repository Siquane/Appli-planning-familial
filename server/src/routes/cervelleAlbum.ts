import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { ALBUM_START, CARDS, DUPLICATE_COINS, MAX_DRAWS, ODDS, cardOf, cardsEarned, drawCard } from "../lib/cervelle/cards";

// Album de cartes (src/lib/cervelle/cards.ts). GET …/album tire les cartes
// gagnées pas encore tirées (CardDraw, numérotées : chaque carte une seule
// fois) ; ?peek=1 dit seulement combien attendent, sans tirer.

async function earned(learner: Learner) {
  const mastered = await prisma.notion.count({ where: { revision: { learnerId: learner.id }, masteredAt: { gte: ALBUM_START }, children: { none: {} } } });
  return cardsEarned(mastered);
}

export function mountAlbum(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  router.get("/learners/:learnerId/album", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    const total = await earned(learner);
    let drawn = await prisma.cardDraw.findMany({ where: { learnerId: learner.id }, orderBy: { n: "asc" } });
    if (req.query.peek === "1") return res.json({ pending: Math.max(0, total - drawn.length) });

    const fresh: typeof drawn = [];
    const owned = new Set(drawn.map((x) => x.cardId));
    for (let n = drawn.length + 1; n <= Math.min(total, drawn.length + MAX_DRAWS); n++) {
      const card = drawCard(Math.random);
      const duplicate = owned.has(card.id);
      const coins = duplicate ? DUPLICATE_COINS[card.rarity] : 0;
      try {
        const [draw] = await prisma.$transaction([
          prisma.cardDraw.create({ data: { learnerId: learner.id, n, cardId: card.id, duplicate, coins } }),
          ...(coins ? [prisma.learner.update({ where: { id: learner.id }, data: { coins: { increment: coins } } })] : []),
        ]);
        fresh.push(draw as (typeof drawn)[number]);
        owned.add(card.id);
      } catch (e) {
        // Two requests at once: the other one drew this card.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") break;
        throw e;
      }
    }
    if (fresh.length) drawn = await prisma.cardDraw.findMany({ where: { learnerId: learner.id }, orderBy: { n: "asc" } });

    const counts = new Map<string, number>();
    for (const x of drawn) counts.set(x.cardId, (counts.get(x.cardId) ?? 0) + 1);
    res.json({
      cards: CARDS.map((card) => ({ ...card, count: counts.get(card.id) ?? 0 })),
      collected: counts.size,
      total: CARDS.length,
      pending: Math.max(0, total - drawn.length),
      odds: ODDS,
      duplicateCoins: DUPLICATE_COINS,
      fresh: fresh.map((x) => ({ ...cardOf(x.cardId)!, duplicate: x.duplicate, coins: x.coins })),
    });
  });
}
