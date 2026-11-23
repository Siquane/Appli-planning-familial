import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { addDays, mondayOf, parisDay } from "../../src/lib/cervelle/days";
import { authHeader, signup } from "../helpers";

describe("Cervelle — objectifs du parent", () => {
  it("lets the parent set goals, shows progress to the child, and marks the reward won", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college" })).body.learner.id as string;
    const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
    const child = { Authorization: `Bearer ${(await request(app).post("/cervelle/child/login").send({ code: code.body.code })).body.token}` };
    const url = `/cervelle/learners/${learnerId}/goals`;

    expect((await request(app).post(url).set(auth).send({ kind: "jours", target: 9, reward: "Ciné" })).status).toBe(400);
    expect((await request(app).post("/cervelle/learners/me/goals").set(child).send({ kind: "jours", target: 2, reward: "Ciné" })).status).toBe(403);
    expect((await request(app).post(url).set(auth).send({ kind: "jours", target: 2, reward: "Une sortie au ciné" })).status).toBe(201);
    expect((await request(app).post(url).set(auth).send({ kind: "etoiles", target: 5, reward: "30 min d'écran" })).status).toBe(201);

    let g = (await request(app).get("/cervelle/learners/me/goals").set(child)).body.goals;
    expect(g[0]).toMatchObject({ kind: "jours", target: 2, current: 0, reached: false, reward: "Une sortie au ciné", wins: 0 });

    const monday = mondayOf(parisDay());
    const days = [monday, addDays(monday, 1)].filter((d) => d <= parisDay());
    // Long quizzes give a star each (½ + ½ effort); two more today make at least 5 stars on any weekday.
    await prisma.studySession.createMany({ data: [...days, parisDay(), parisDay(), parisDay()].map((day) => ({ learnerId, mode: "qcm", correct: 9, total: 10, seconds: 60, day })) });
    g = (await request(app).get(url).set(auth)).body.goals;
    expect(g[1]).toMatchObject({ kind: "etoiles", reached: true, current: 5, wins: 1 });
    if (new Set([...days, parisDay()]).size >= 2) expect(g[0]).toMatchObject({ reached: true, current: 2, wins: 1 });
    // Asking again doesn't count the same week twice.
    expect((await request(app).get(url).set(auth)).body.goals[1].wins).toBe(1);

    expect((await request(app).delete(`${url}/${g[0].id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(url).set(auth)).body.goals).toHaveLength(1);
  });
});
