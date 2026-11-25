import type { Learner } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { Request, Response, Router } from "express";
import { prisma } from "../db";
import { parisDay } from "../lib/cervelle/days";
import { DECOR_AFTER, ISLAND_COINS, PIRATE_HAT, TREASURE_DECOR, islandName, islandsOf } from "../lib/cervelle/islands";
import { equip, onSale, SHOP, shopItem } from "../lib/cervelle/shop";
import { openChest } from "../lib/cervelle/stars";

// Carte au trésor (src/lib/cervelle/islands.ts). GET montre les îles et paie,
// une seule fois, ce qui vient d'être gagné (StarEvent « ile:… » ; badge
// LearnerBadge « ile:<id> »).

type Fresh = { kind: "coffre" | "chapeau" | "decor"; island: string | null; islandName: string | null; coins: number; item: string | null; itemName: string | null };

/** Paie une récompense une fois. Null si elle l'était déjà. */
async function pay(learner: Learner, key: string, coins: number, item: string | null, badge: string | null, wear: boolean) {
  try {
    await prisma.$transaction([
      prisma.starEvent.create({ data: { learnerId: learner.id, key, day: parisDay(), coins, item } }),
      prisma.learner.update({
        where: { id: learner.id },
        data: {
          coins: { increment: coins },
          ...(item && !learner.owned.includes(item) ? { owned: { push: item } } : {}),
          ...(item && wear ? { equipped: equip(learner.equipped, item) } : {}),
        },
      }),
      ...(badge ? [prisma.learnerBadge.upsert({ where: { learnerId_key: { learnerId: learner.id, key: badge } }, create: { learnerId: learner.id, key: badge }, update: {} })] : []),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
  if (item) {
    if (!learner.owned.includes(item)) learner.owned.push(item);
    if (wear) learner.equipped = equip(learner.equipped, item);
  }
  return true;
}

export function mountIslands(router: Router, d: { loadLearner: (req: Request, res: Response) => Promise<Learner | null> }) {
  router.get("/learners/:learnerId/islands", async (req, res) => {
    const learner = await d.loadLearner(req, res);
    if (!learner) return;
    // Les notions « feuilles » (celles qui ont des questions), maîtrisées au moins une fois.
    const notions = await prisma.notion.findMany({
      where: { revision: { learnerId: learner.id }, masteredAt: { not: null }, children: { none: {} } },
      select: { title: true, masteredAt: true, revision: { select: { subject: true, title: true } } },
    });
    const islands = islandsOf(notions.map((n) => ({ title: n.title, subject: n.revision.subject, revisionTitle: n.revision.title, masteredAt: n.masteredAt! })));

    const paid = new Set((await prisma.starEvent.findMany({ where: { learnerId: learner.id, key: { startsWith: "ile:" } }, select: { key: true } })).map((e) => e.key));
    const fresh: Fresh[] = [];
    const name = (id: string | null) => (id ? (shopItem(id)?.name ?? id) : null);
    const complete = islands.filter((i) => i.complete);
    for (const island of complete) {
      const key = `ile:${island.id}`;
      if (paid.has(key)) continue;
      const owned = new Set(learner.owned);
      const candidates = SHOP.filter((i) => i.kind === "normal" && i.price > 0 && i.price <= 150 && onSale(i, parisDay()) && !owned.has(i.id)).map((i) => i.id);
      const chest = openChest(Math.random, candidates);
      const coins = ISLAND_COINS + chest.coins;
      if (await pay(learner, key, coins, chest.item, key, !!chest.item)) fresh.push({ kind: "coffre", island: island.id, islandName: island.name, coins, item: chest.item, itemName: name(chest.item) });
    }
    if (complete.length >= 1 && !paid.has("ile:chapeau") && (await pay(learner, "ile:chapeau", 0, PIRATE_HAT, null, true))) {
      fresh.push({ kind: "chapeau", island: null, islandName: null, coins: 0, item: PIRATE_HAT, itemName: name(PIRATE_HAT) });
    }
    if (complete.length >= DECOR_AFTER && !paid.has("ile:decor") && (await pay(learner, "ile:decor", 0, TREASURE_DECOR, null, true))) {
      fresh.push({ kind: "decor", island: null, islandName: null, coins: 0, item: TREASURE_DECOR, itemName: name(TREASURE_DECOR) });
    }

    res.json({
      // L'île Mystère n'apparaît que si elle a quelque chose.
      islands: islands.filter((i) => i.id !== "mystere" || i.mastered > 0),
      completeCount: complete.length,
      decorAfter: DECOR_AFTER,
      fresh,
    });
  });
}

export { islandName };
