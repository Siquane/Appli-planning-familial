import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { parisDay } from "../../src/lib/cervelle/days";
import { themeOf } from "../../src/lib/cervelle/stars";
import { authHeader, signup } from "../helpers";

describe("Cervelle — chemin d'étoiles (route)", () => {
  it("counts the month's stars, pays each step once, and gives the item and badge at 500", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/stars`;
    const today = parisDay();

    const empty = await request(app).get(url).set(auth);
    expect(empty.body).toMatchObject({ stars: 0, end: 500, fresh: [] });
    expect(empty.body.steps).toHaveLength(100);

    // 49 long quizzes on one day: 49 × (½ + ½) + 1 day = 50 stars → rewards at 25 and 50.
    await prisma.studySession.createMany({ data: Array.from({ length: 49 }, () => ({ learnerId, mode: "qcm", correct: 9, total: 10, seconds: 60, day: today })) });
    const before = (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins;
    const r1 = await request(app).get(url).set(auth);
    expect(r1.body.stars).toBe(50);
    expect(r1.body.fresh.map((f: { at: number }) => f.at)).toEqual([25, 50]);
    expect(r1.body.steps[4]).toMatchObject({ at: 25, reached: true, result: { coins: 10 } });
    // Squares without a reward pay nothing.
    expect(r1.body.steps[0]).toMatchObject({ at: 5, reached: true, reward: { type: "none" }, result: null });
    const after = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } });
    const chest = r1.body.fresh[1];
    expect(after.coins).toBe(before + 10 + chest.coins);
    // A prize is worn at once.
    if (chest.item) {
      expect(after.owned).toContain(chest.item);
      expect(after.equipped).toContain(chest.item);
    }

    // Asking again pays nothing more.
    expect((await request(app).get(url).set(auth)).body.fresh).toEqual([]);

    // Up to 500: the month's exclusive item and the path badge.
    await prisma.studySession.createMany({ data: Array.from({ length: 451 }, () => ({ learnerId, mode: "qcm", correct: 10, total: 10, seconds: 60, day: today })) });
    const r2 = await request(app).get(url).set(auth);
    expect(r2.body.stars).toBe(501);
    expect(r2.body.steps.at(-1)).toMatchObject({ reached: true, result: { item: themeOf(today.slice(0, 7)).item } });
    const final = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } });
    expect(final.owned).toContain(themeOf(today.slice(0, 7)).item);
    expect(final.equipped).toContain(themeOf(today.slice(0, 7)).item);
    const badges = await request(app).get(`/cervelle/learners/${learnerId}/badges`).set(auth);
    expect(badges.body.windows[0]).toMatchObject({ family: "chemin", earned: true });

    // The path item can be worn but not bought.
    const shop = await request(app).get(`/cervelle/learners/${learnerId}/shop`).set(auth);
    expect(shop.body.items.find((i: { id: string }) => i.id === themeOf(today.slice(0, 7)).item)).toMatchObject({ kind: "chemin", owned: true, onSale: false });
  });
});
