import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { addDays, parisDay } from "../../src/lib/cervelle/days";
import { authHeader, signup } from "../helpers";

async function family() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" });
  const learnerId = created.body.learner.id as string;
  const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
  const login = await request(app).post("/cervelle/child/login").send({ code: code.body.code });
  return { learnerId, child: { Authorization: `Bearer ${login.body.token}` } };
}

describe("Cervelle — widget", () => {
  it("gives an empty widget for a new child", async () => {
    const { child } = await family();
    const res = await request(app).get("/cervelle/learners/me/widget").set(child);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Léa", streak: 0, studiedToday: false, exam: null, card: null, stars: { total: 0, end: 50 } });
    expect(res.body.missions.total).toBeGreaterThan(0);
  });

  it("shows the next interro and a card of the day, the same all day, preferring one to review", async () => {
    const { learnerId, child } = await family();
    const today = parisDay();
    await prisma.revision.create({ data: { learnerId, title: "Les fractions", subject: "Maths", status: "ready", examDate: new Date(`${addDays(today, 9)}T00:00:00Z`) } });
    const soon = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "SVT", status: "ready", examDate: new Date(`${addDays(today, 3)}T00:00:00Z`) } });
    const a = await prisma.notion.create({ data: { revisionId: soon.id, title: "Magma", mastery: "mastered" } });
    const b = await prisma.notion.create({ data: { revisionId: soon.id, title: "Lave", mastery: "review" } });
    await prisma.question.create({ data: { revisionId: soon.id, notionId: a.id, type: "carte", prompt: "Le magma ?", answer: "Roche fondue" } });
    await prisma.question.create({ data: { revisionId: soon.id, notionId: b.id, type: "carte", prompt: "La lave ?", answer: "Magma sorti" } });
    await prisma.learner.update({ where: { id: learnerId }, data: { lastStudyDay: today, streak: 4 } });

    const res = await request(app).get("/cervelle/learners/me/widget").set(child);
    expect(res.body).toMatchObject({ streak: 4, studiedToday: true });
    expect(res.body.exam).toMatchObject({ revisionId: soon.id, daysLeft: 3, mastered: 1, notions: 2 });
    expect(res.body.card).toEqual({ front: "La lave ?", back: "Magma sorti", revisionId: soon.id, title: "Les volcans" });
    const again = await request(app).get("/cervelle/learners/me/widget").set(child);
    expect(again.body.card).toEqual(res.body.card);
  });
});
