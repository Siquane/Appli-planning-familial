import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { duelWinner } from "../../src/routes/cervelleDuels";
import { authHeader, signup } from "../helpers";

async function child(name: string) {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name, level: "college" });
  const learnerId = created.body.learner.id as string;
  const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
  const login = await request(app).post("/cervelle/child/login").send({ code: code.body.code });
  return { learnerId, child: { Authorization: `Bearer ${login.body.token}` } };
}

async function course(learnerId: string, n: number) {
  const r = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "SVT", status: "ready" } });
  const notion = await prisma.notion.create({ data: { revisionId: r.id, title: "Le magma" } });
  for (let i = 0; i < n; i++) {
    await prisma.question.create({ data: { revisionId: r.id, notionId: notion.id, type: i % 2 ? "qcm" : "vrai_faux", prompt: `Q${i}`, choices: i % 2 ? ["a", "b", "c"] : [], answer: i % 2 ? "1" : "vrai", order: i } });
  }
  await prisma.question.create({ data: { revisionId: r.id, notionId: notion.id, type: "courte", prompt: "Libre", answer: "lave" } });
  return r.id;
}

describe("Cervelle — défis quiz", () => {
  it("lets two approved friends play the same questions; the best score wins the coins once", async () => {
    const lea = await child("Léa");
    const tom = await child("Tom");
    const revisionId = await course(lea.learnerId, 12);

    // Not friends yet: refused.
    expect((await request(app).post("/cervelle/learners/me/duels").set(lea.child).send({ friendId: tom.learnerId, revisionId })).status).toBe(404);
    await prisma.friendship.create({ data: { fromId: lea.learnerId, toId: tom.learnerId, fromApproved: true, toApproved: true } });

    const created = await request(app).post("/cervelle/learners/me/duels").set(lea.child).send({ friendId: tom.learnerId, revisionId });
    expect(created.status).toBe(201);
    const id = created.body.duel.id as string;

    const qs = await request(app).get(`/cervelle/learners/me/duels/${id}`).set(tom.child);
    expect(qs.body.questions).toHaveLength(10);
    expect(qs.body.questions[0]).not.toHaveProperty("answer");
    expect(qs.body.questions.every((q: { type: string }) => q.type === "qcm" || q.type === "vrai_faux")).toBe(true);

    const right = (q: { id: string; type: string }) => ({ questionId: q.id, answer: q.type === "qcm" ? "1" : "vrai" });
    const all = qs.body.questions.map(right);
    const before = (await prisma.learner.findUniqueOrThrow({ where: { id: tom.learnerId } })).coins;

    // Tom answers everything right; Léa gets one wrong.
    const t = await request(app).post(`/cervelle/learners/me/duels/${id}/answers`).set(tom.child).send({ answers: all });
    expect(t.body).toMatchObject({ score: 10, total: 10, result: null, coins: 0 });
    expect((await request(app).post(`/cervelle/learners/me/duels/${id}/answers`).set(tom.child).send({ answers: all })).status).toBe(409);

    const list = await request(app).get("/cervelle/learners/me/duels").set(lea.child);
    expect(list.body.duels[0]).toMatchObject({ theyPlayed: true, theirScore: null, myScore: null, sentByMe: true });

    const l = await request(app).post(`/cervelle/learners/me/duels/${id}/answers`).set(lea.child).send({ answers: [{ ...all[0], answer: "nope" }, ...all.slice(1)] });
    expect(l.body).toMatchObject({ score: 9, theirScore: 10, result: "lost", coins: 0 });
    expect((await prisma.learner.findUniqueOrThrow({ where: { id: tom.learnerId } })).coins).toBe(before + 20);

    const done = await request(app).get("/cervelle/learners/me/duels").set(tom.child);
    expect(done.body.duels[0]).toMatchObject({ status: "done", result: "won", myScore: 10, theirScore: 9, friend: { name: "Léa" } });
  });

  it("refuses a course with too few questions, and knows a draw", async () => {
    const lea = await child("Léa");
    const tom = await child("Tom");
    await prisma.friendship.create({ data: { fromId: lea.learnerId, toId: tom.learnerId, fromApproved: true, toApproved: true } });
    const revisionId = await course(lea.learnerId, 3);
    expect((await request(app).post("/cervelle/learners/me/duels").set(lea.child).send({ friendId: tom.learnerId, revisionId })).status).toBe(400);
    expect(duelWinner("a", 5, "b", 5)).toBe("draw");
    expect(duelWinner("a", 5, "b", null)).toBeNull();
  });
});
