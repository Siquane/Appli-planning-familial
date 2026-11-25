import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

describe("Cervelle — boss de fin de chapitre", () => {
  it("comes when every notion was worked on, and pays the first victory once", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const revision = await prisma.revision.create({ data: { learnerId, title: "Les fractions", subject: "Maths", status: "ready" } });
    const a = await prisma.notion.create({ data: { revisionId: revision.id, title: "A" } });
    const b = await prisma.notion.create({ data: { revisionId: revision.id, title: "B" } });
    for (const [i, n] of [a, b, a, b, a, b, a, b, a, b, a, b].entries()) {
      await prisma.question.create({ data: { revisionId: revision.id, notionId: n.id, type: i % 3 === 0 ? "carte" : "qcm", prompt: `Q${i}`, choices: ["x", "y"], answer: "0" } });
    }
    const detail = () => request(app).get(`/cervelle/learners/${learnerId}/revisions/${revision.id}`).set(auth);
    const quiz = () => request(app).get(`/cervelle/learners/${learnerId}/quiz?mode=boss&revisionId=${revision.id}`).set(auth);

    expect((await detail()).body.revision.boss).toEqual({ ready: false, beaten: false, hearts: 10 });
    expect((await quiz()).status).toBe(400);

    await prisma.notion.updateMany({ where: { revisionId: revision.id }, data: { lastAnsweredAt: new Date() } });
    expect((await detail()).body.revision.boss.ready).toBe(true);
    const q = await quiz();
    expect(q.status).toBe(200);
    // No flash card in a boss fight.
    expect(q.body.questions.every((x: { type: string }) => x.type !== "carte")).toBe(true);

    const fight = (correct: number) => request(app).post(`/cervelle/learners/${learnerId}/sessions`).set(auth).send({ revisionId: revision.id, mode: "boss", seconds: 120, correct, total: 8 });
    const lost = await fight(5);
    expect(lost.body.boss).toEqual({ won: false, first: false, coins: 0, stars: 0 });
    const won = await fight(8);
    expect(won.body.boss).toEqual({ won: true, first: true, coins: 30, stars: 5 });
    expect((await fight(8)).body.boss).toMatchObject({ won: true, first: false, coins: 0 });
    expect((await detail()).body.revision.boss.beaten).toBe(true);
    // The 5 stars go on the path.
    const stars = (await request(app).get(`/cervelle/learners/${learnerId}/stars`).set(auth)).body;
    expect(stars.breakdown.missions).toBe(5);
  });
});
