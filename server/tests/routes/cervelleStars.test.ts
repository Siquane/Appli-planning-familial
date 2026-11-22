import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { parisDay } from "../../src/lib/cervelle/days";
import { themeOf } from "../../src/lib/cervelle/stars";
import { authHeader, signup } from "../helpers";

describe("Cervelle — chemin d'étoiles (route)", () => {
  it("counts the month's stars, pays each step once, and gives the item and badge at 50", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/stars`;
    const today = parisDay();

    const empty = await request(app).get(url).set(auth);
    expect(empty.body).toMatchObject({ stars: 0, end: 50, fresh: [] });
    expect(empty.body.steps).toHaveLength(12);

    // 4 good quizzes on one day: 4×2 + 1 day = 9 stars → steps 3 and 6.
    await prisma.studySession.createMany({ data: Array.from({ length: 4 }, () => ({ learnerId, mode: "qcm", correct: 9, total: 10, seconds: 60, day: today })) });
    const before = (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins;
    const r1 = await request(app).get(url).set(auth);
    expect(r1.body.stars).toBe(9);
    expect(r1.body.fresh.map((f: { at: number }) => f.at)).toEqual([3, 6]);
    expect(r1.body.steps[0]).toMatchObject({ at: 3, reached: true, result: { coins: 10 } });
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

    // Up to 50: the month's exclusive item and the path badge.
    await prisma.studySession.createMany({ data: Array.from({ length: 21 }, () => ({ learnerId, mode: "qcm", correct: 10, total: 10, seconds: 60, day: today })) });
    const r2 = await request(app).get(url).set(auth);
    expect(r2.body.stars).toBe(51);
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
