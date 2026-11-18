import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { addDays, mondayOf, parisDay } from "../../src/lib/cervelle/days";
import { BADGE_LABELS } from "../../src/lib/cervelle/badges";
import { authHeader, signup } from "../helpers";

async function family() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" });
  return { auth, learnerId: created.body.learner.id as string };
}

describe("Cervelle — bilan de la semaine", () => {
  it("sums the week, compares with the one before, and lists what to review and the interros", async () => {
    const { auth, learnerId } = await family();
    const monday = mondayOf(parisDay());
    const r = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "SVT", status: "ready", examDate: new Date(`${addDays(parisDay(), 3)}T08:00:00Z`) } });
    await prisma.notion.create({ data: { revisionId: r.id, title: "Le magma", mastery: "review", nextReviewAt: new Date() } });
    await prisma.studySession.createMany({
      data: [
        { learnerId, revisionId: r.id, mode: "qcm", correct: 8, total: 10, seconds: 600, day: monday },
        { learnerId, revisionId: r.id, mode: "qcm", correct: 10, total: 10, seconds: 600, day: monday },
        { learnerId, mode: "minuteur", seconds: 1200, day: addDays(monday, -3) },
      ],
    });
    await prisma.learnerBadge.create({ data: { learnerId, key: "photographe:1" } });

    const res = await request(app).get(`/cervelle/learners/${learnerId}/weekly`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ from: monday, to: addDays(monday, 6), minutes: 20, minutesBefore: 20, activeDays: 1, quizzes: 2, quizAverage: 90, answers: 20 });
    expect(res.body.perDay).toHaveLength(7);
    expect(res.body.subjects).toEqual([{ subject: "SVT", minutes: 20 }]);
    expect(res.body.toReview).toEqual([expect.objectContaining({ title: "Le magma", revision: "Les volcans" })]);
    expect(res.body.exams).toEqual([expect.objectContaining({ title: "Les volcans", day: addDays(parisDay(), 3) })]);
    expect(res.body.badges).toEqual([{ key: "photographe:1", label: "Photographe (bronze)" }]);

    const before = await request(app).get(`/cervelle/learners/${learnerId}/weekly?week=${addDays(monday, -7)}`).set(auth);
    expect(before.body).toMatchObject({ minutes: 20, quizzes: 0, quizAverage: null, badges: [] });
  });

  it("names badges", () => {
    expect(BADGE_LABELS("regulier:3")).toBe("Régulier (or)");
    expect(BADGE_LABELS("saison:hiver:2026")).toBe("Hiver 2026");
    expect(BADGE_LABELS("fete:noel:2026")).toBe("Noël 2026");
  });
});
