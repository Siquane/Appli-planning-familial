import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { signAccessToken } from "../../src/lib/jwt";
import { authHeader, signup } from "../helpers";


describe("Cervelle — calendrier de l'Avent (route)", () => {
  afterEach(() => vi.useRealTimers());

  it("opens a box after a revision, pays stars and items once, and lets a missed box be caught up", async () => {
    const { accessToken, user } = await signup(app);
    let auth = authHeader(accessToken);
    // Move the clock (Date only), with a token signed at that time.
    const at = (iso: string) => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date(iso) });
      auth = authHeader(signAccessToken({ sub: user.id, email: user.email }));
    };
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/advent`;
    const session = (day: string) => prisma.studySession.create({ data: { learnerId, mode: "qcm", correct: 3, total: 5, seconds: 60, day } });

    // Before the season: nothing.
    at("2026-10-10T10:00:00Z");
    expect((await request(app).get(url).set(auth)).body.advent).toBeNull();

    // Preview in November.
    at("2026-11-25T10:00:00Z");
    const soon = (await request(app).get(url).set(auth)).body.advent;
    expect(soon).toMatchObject({ phase: "bientot", daysUntil: 6, keysLeft: 0 });
    expect((await request(app).post(`${url}/1/open`).set(auth)).status).toBe(400);

    // 1 December without a revision: locked. After one: opens, 3 stars.
    at("2026-12-01T09:00:00Z");
    const locked = await request(app).post(`${url}/1/open`).set(auth);
    expect(locked.status).toBe(400);
    expect(locked.body.error).toContain("révision");
    await session("2026-12-01");
    const one = await request(app).post(`${url}/1/open`).set(auth);
    expect(one.status).toBe(200);
    expect(one.body.opened.reward).toMatchObject({ type: "stars", stars: 3 });
    expect((await request(app).post(`${url}/1/open`).set(auth)).status).toBe(409);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/stars`).set(auth)).body.breakdown.missions).toBe(3);

    // 2 and 3 December missed; on the 4th two revisions open two boxes (the item one and a missed one).
    at("2026-12-04T17:00:00Z");
    await session("2026-12-04");
    await session("2026-12-04");
    const four = await request(app).post(`${url}/4/open`).set(auth);
    expect(four.body.opened.reward).toMatchObject({ type: "item", item: "nez_renne", itemName: "Nez de renne" });
    expect(four.body.learner.equipped).toContain("nez_renne");
    const two = await request(app).post(`${url}/2/open`).set(auth);
    expect(two.body.opened.reward.type).toBe("defi");
    expect(two.body.opened.reward.text).toBeTruthy();
    const three = await request(app).post(`${url}/3/open`).set(auth);
    expect(three.status).toBe(400);
    expect(three.body.error).toContain("rattraper");
    // Not yet arrived.
    expect((await request(app).post(`${url}/5/open`).set(auth)).body.error).toContain("5 décembre");

    const view = (await request(app).get(url).set(auth)).body.advent;
    expect(view).toMatchObject({ phase: "ouvert", today: 4, keys: 3, keysLeft: 0, revisedToday: true });
    expect(view.cells.filter((c: { opened: boolean }) => c.opened).map((c: { day: number }) => c.day)).toEqual([1, 2, 4]);
    expect(view.cells[2].reward).toBeNull();

    // The item shows in the shop as owned, not for sale.
    const shop = await request(app).get(`/cervelle/learners/${learnerId}/shop`).set(auth);
    expect(shop.body.items.find((i: { id: string }) => i.id === "nez_renne")).toMatchObject({ kind: "avent", owned: true, onSale: false });
  });
});
