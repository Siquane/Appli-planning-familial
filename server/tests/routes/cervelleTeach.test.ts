import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

describe("Cervelle — Apprends-le à papa/maman", () => {
  it("sends 5 questions to the family, a parent answers once, the child sees it and gets stars", async () => {
    const { accessToken } = await signup(app, { name: "Claire Dubois" });
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const revision = await prisma.revision.create({ data: { learnerId, title: "Les fractions", subject: "Maths", status: "ready" } });
    const notion = await prisma.notion.create({ data: { revisionId: revision.id, title: "A" } });
    for (let i = 0; i < 4; i++) await prisma.question.create({ data: { revisionId: revision.id, notionId: notion.id, type: "qcm", prompt: `Q${i}`, choices: ["a", "b", "c"], answer: "1" } });
    await prisma.question.create({ data: { revisionId: revision.id, notionId: notion.id, type: "vrai_faux", prompt: "VF", answer: "faux" } });
    await prisma.question.create({ data: { revisionId: revision.id, notionId: notion.id, type: "carte", prompt: "Carte", answer: "x" } });

    const sent = await request(app).post(`/cervelle/learners/${learnerId}/teach`).set(auth).send({ revisionId: revision.id });
    expect(sent.status).toBe(201);
    const id = sent.body.quiz.id as string;
    expect(sent.body.quiz.questions).toHaveLength(5);

    const pending = (await request(app).get("/cervelle/teach/pending").set(auth)).body.quizzes;
    expect(pending).toEqual([expect.objectContaining({ id, learnerName: "Jules", revisionTitle: "Les fractions" })]);

    const quiz = (await request(app).get(`/cervelle/teach/${id}`).set(auth)).body.quiz;
    // Before answering, the right answers stay hidden.
    expect(quiz.questions[0].expected).toBeUndefined();

    // Answer: every QCM right (index 1), the true/false wrong (0 = vrai).
    const answers = quiz.questions.map((q: { type: string }) => (q.type === "qcm" ? "1" : "0"));
    const done = await request(app).post(`/cervelle/teach/${id}/answers`).set(auth).send({ answers });
    expect(done.status).toBe(200);
    expect(done.body.quiz).toMatchObject({ answered: true, answeredByName: "Claire", score: 4, total: 5 });
    expect((await request(app).post(`/cervelle/teach/${id}/answers`).set(auth).send({ answers })).status).toBe(409);
    expect((await request(app).get("/cervelle/teach/pending").set(auth)).body.quizzes).toEqual([]);

    // The child: the answers, and 3 stars for teaching.
    const list = (await request(app).get(`/cervelle/learners/${learnerId}/teach`).set(auth)).body;
    expect(list.unseen).toBe(1);
    const vf = list.quizzes[0].questions.find((q: { type: string }) => q.type === "vrai_faux");
    expect(vf).toMatchObject({ choices: ["Vrai", "Faux"], expected: 1, given: 0, correct: false });
    await request(app).post(`/cervelle/learners/${learnerId}/teach/seen`).set(auth);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/teach`).set(auth)).body.unseen).toBe(0);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/stars`).set(auth)).body.breakdown.missions).toBe(3);

    // Another family cannot see it.
    const other = authHeader((await signup(app)).accessToken);
    expect((await request(app).get(`/cervelle/teach/${id}`).set(other)).status).toBe(404);
  });
});
