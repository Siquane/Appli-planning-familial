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
    expect(empty.body.records.map((r: { id: string }) => r.id)).toEqual(["serie", "interro", "temps", "questions"]);

    const revision = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "SVT", status: "ready" } });
    await prisma.studySession.create({ data: { learnerId, revisionId: revision.id, mode: "qcm", correct: 10, total: 10, seconds: 300, day: parisDay() } });
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
});
