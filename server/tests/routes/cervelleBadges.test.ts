import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { parisDay } from "../../src/lib/cervelle/days";
import { authHeader, signup } from "../helpers";

async function family() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" });
  const learnerId = created.body.learner.id as string;
  const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
  const login = await request(app).post("/cervelle/child/login").send({ code: code.body.code });
  return { auth, learnerId, child: { Authorization: `Bearer ${login.body.token}` } };
}

describe("Cervelle — badges", () => {
  it("earns badges from what is stored, pays them once, and clears the dots when the child looks", async () => {
    const { auth, learnerId, child } = await family();
    const empty = await request(app).get("/cervelle/learners/me/badges").set(child);
    expect(empty.status).toBe(200);
    expect(empty.body.coinsEarned).toBe(0);
    expect(empty.body.successes.every((s: { tier: number }) => s.tier === 0)).toBe(true);
    expect(empty.body.records.map((r: { id: string }) => r.id)).toEqual(["serie", "notions", "temps", "questions"]);

    const revision = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "SVT", status: "ready" } });
    await prisma.studySession.create({ data: { learnerId, revisionId: revision.id, mode: "a_revoir", correct: 6, total: 10, seconds: 300, day: parisDay() } });
    const before = (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins;

    const first = await request(app).get("/cervelle/learners/me/badges").set(child);
    expect(first.body.added.sort()).toEqual(["photographe:1", "sans_faute:1"]);
    expect(first.body.coinsEarned).toBe(20);
    expect(first.body.successes.find((s: { id: string }) => s.id === "sans_faute")).toMatchObject({ tier: 1, isNew: true });
    expect((await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins).toBe(before + 20);

    const again = await request(app).get(`/cervelle/learners/${learnerId}/badges`).set(auth);
    expect(again.body.coinsEarned).toBe(0);
    expect(again.body.newCount).toBe(2);

    // A parent looking keeps the child's red dots.
    expect((await request(app).post(`/cervelle/learners/${learnerId}/badges/seen`).set(auth)).status).toBe(204);
    expect((await request(app).get("/cervelle/learners/me/badges").set(child)).body.newCount).toBe(2);
    await request(app).post("/cervelle/learners/me/badges/seen").set(child);
    const seen = await request(app).get("/cervelle/learners/me/badges").set(child);
    expect(seen.body.newCount).toBe(0);
    expect(seen.body.successes.find((s: { id: string }) => s.id === "photographe").isNew).toBe(false);
  });

  it("dresses Cervelle: badge items, seasons, colours and saved outfits", async () => {
    const { learnerId, child } = await family();
    await prisma.learner.update({ where: { id: learnerId }, data: { coins: 500 } });
    const url = "/cervelle/learners/me/shop";

    expect((await request(app).post(`${url}/couronne_or/buy`).set(child)).status).toBe(400);
    expect((await request(app).post(`${url}/couronne_or/equip`).set(child)).status).toBe(400);
    await prisma.learnerBadge.create({ data: { learnerId, key: "regulier:3" } });
    expect((await request(app).post(`${url}/couronne_or/equip`).set(child)).status).toBe(200);

    expect((await request(app).post(`${url}/bleu/buy`).set(child)).status).toBe(200);
    expect((await request(app).post(`${url}/lunettes/buy`).set(child)).status).toBe(200);
    const shop = await request(app).get(url).set(child);
    const find = (id: string) => shop.body.items.find((i: { id: string }) => i.id === id);
    expect(find("couronne_or")).toMatchObject({ kind: "badge", owned: true, equipped: true, badge: "Régulier en or" });
    expect(find("bleu")).toMatchObject({ owned: true, equipped: true });
    expect(find("rose")).toMatchObject({ owned: true, equipped: false });
    expect(shop.body.coins).toBe(500 - 80 - 40);

    // Save outfit 1, change, then put outfit 1 back on.
    const saved = await request(app).put(`${url}/outfits/1`).set(child);
    expect(saved.body.outfits[0].sort()).toEqual(["bleu", "couronne_or", "lunettes"]);
    await request(app).post(`${url}/rose/equip`).set(child);
    await request(app).post(`${url}/lunettes/equip`).set(child).send({ on: false });
    const plain = await request(app).get(url).set(child);
    expect(plain.body.items.find((i: { id: string }) => i.id === "rose").equipped).toBe(true);
    const worn = await request(app).post(`${url}/outfits/1/wear`).set(child);
    expect(worn.body.learner.equipped.sort()).toEqual(["bleu", "couronne_or", "lunettes"]);
    expect((await request(app).post(`${url}/outfits/2/wear`).set(child)).status).toBe(404);
    expect((await request(app).put(`${url}/outfits/4`).set(child)).status).toBe(404);
  });
});
