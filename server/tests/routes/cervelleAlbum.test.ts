import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

describe("Cervelle — album de cartes (route)", () => {
  it("draws the welcome cards, then one per notion mastered, each once", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/album`;

    expect((await request(app).get(`${url}?peek=1`).set(auth)).body).toEqual({ pending: 3 });
    const first = (await request(app).get(url).set(auth)).body;
    expect(first.fresh).toHaveLength(3);
    expect(first).toMatchObject({ total: 55, pending: 0 });
    expect(first.cards.reduce((n: number, c: { count: number }) => n + c.count, 0)).toBe(3);
    expect((await request(app).get(url).set(auth)).body.fresh).toEqual([]);

    // Two notions mastered (and one before the album arrived, which does not count).
    const revision = await prisma.revision.create({ data: { learnerId, title: "Fractions", subject: "Maths", status: "ready" } });
    await prisma.notion.createMany({
      data: [
        { revisionId: revision.id, title: "A", mastery: "mastered", masteredAt: new Date() },
        { revisionId: revision.id, title: "B", mastery: "mastered", masteredAt: new Date() },
        { revisionId: revision.id, title: "Old", mastery: "mastered", masteredAt: new Date("2026-10-01T00:00:00Z") },
      ],
    });
    expect((await request(app).get(`${url}?peek=1`).set(auth)).body).toEqual({ pending: 2 });
    const coinsBefore = (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins;
    const second = (await request(app).get(url).set(auth)).body;
    expect(second.fresh).toHaveLength(2);
    // A card already in the album becomes coins.
    const dupCoins = second.fresh.reduce((n: number, f: { coins: number }) => n + f.coins, 0);
    expect((await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins).toBe(coinsBefore + dupCoins);
    expect(await prisma.cardDraw.count({ where: { learnerId } })).toBe(5);
  });
});
