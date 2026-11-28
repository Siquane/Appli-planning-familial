import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";
import { longestRun, seriesBonuses } from "../../src/lib/stars";
import { setPushSender, type PushMessage } from "../../src/lib/familyAlerts";

const WEEK = "2026-11-16";

async function family() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const leo = (await request(app).post("/members").set(auth).send({ name: "Léo", initials: "L", age: 12 })).body.member;
  const code = (await request(app).post(`/family/children/${leo.id}/code`).set(auth)).body.code;
  const childAuth = authHeader((await request(app).post("/auth/child-code").send({ code })).body.accessToken);
  await request(app).put("/notifications/push-token").set(auth).send({ token: "ExponentPushToken[parent]" });
  await request(app).put("/notifications/push-token").set(childAuth).send({ token: "ExponentPushToken[child]" });
  return { auth, leo, childAuth };
}

const sent: PushMessage[] = [];
afterEach(() => {
  sent.length = 0;
});

describe("séries", () => {
  it("counts days in a row", () => {
    expect(longestRun([0, 1, 2, 4])).toBe(3);
    expect(longestRun([3])).toBe(1);
    expect(longestRun([])).toBe(0);
    expect(seriesBonuses([0, 1, 2, 3, 4]).map((l) => l.days)).toEqual([3, 5]);
    expect(seriesBonuses([0, 2, 4])).toEqual([]);
  });
});

describe("/stars claims, series bonus and family goal", () => {
  it("a teen says « J'ai fini », an adult accepts; series bonus and goal follow", async () => {
    setPushSender(async (m) => {
      sent.push(...m);
    });
    const { auth, leo, childAuth } = await family();
    const seriesId = "serie_chambre_1";
    const tasks = [];
    for (const weekday of [0, 1, 2]) {
      tasks.push((await request(app).post("/tasks").set(auth).send({ title: "Ranger sa chambre", category: "Maison", weekday, time: "18:00", stars: 1, memberIds: [leo.id], seriesId })).body.task);
    }
    expect((await request(app).put("/stars/goal").set(auth).send({ title: "Soirée pizza", target: 4 })).status).toBe(204);
    // Un enfant ne crée pas l'objectif.
    expect((await request(app).put("/stars/goal").set(childAuth).send({ title: "x", target: 1 })).status).toBe(403);

    // L'ado dit qu'il a fini le lundi ; un adulte valide.
    expect((await request(app).post("/stars/claims").set(childAuth).send({ taskId: tasks[0].id, week: WEEK })).status).toBe(201);
    expect((await request(app).post("/stars/claims").set(childAuth).send({ taskId: tasks[0].id, week: WEEK })).status).toBe(409);
    expect((await request(app).post("/stars/claims").set(auth).send({ taskId: tasks[0].id, week: WEEK })).status).toBe(403);
    let state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.claims).toEqual([expect.objectContaining({ taskId: tasks[0].id, memberId: leo.id, status: "pending", title: "Ranger sa chambre" })]);
    expect(sent.some((m) => m.body.includes("Léo a fini"))).toBe(true);
    // L'enfant ne valide pas sa propre demande.
    expect((await request(app).post(`/stars/claims/${state.claims[0].id}/accept`).set(childAuth)).status).toBe(403);
    expect((await request(app).post(`/stars/claims/${state.claims[0].id}/accept`).set(auth)).status).toBe(204);
    state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children[0]).toMatchObject({ balance: 1 });
    expect(state.claims[0].status).toBe("accepted");

    // Mardi et mercredi cochés par l'adulte : 3 jours de suite, +1 étoile de bonus, objectif (4) atteint.
    await request(app).post("/stars/complete").set(auth).send({ taskId: tasks[1].id, memberId: leo.id, week: WEEK });
    await request(app).post("/stars/complete").set(auth).send({ taskId: tasks[2].id, memberId: leo.id, week: WEEK });
    state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children[0]).toMatchObject({ balance: 4, weekStars: 4 });
    expect(state.history.some((h: { title: string }) => h.title.includes("3 jours de suite"))).toBe(true);
    expect(state.goal).toEqual({ title: "Soirée pizza", target: 4, progress: 4, reached: true });
    expect(sent.filter((m) => m.body.includes("Soirée pizza"))).toHaveLength(2);

    // Décocher mardi : la série est cassée, le bonus disparaît.
    await request(app).delete("/stars/complete").set(auth).send({ taskId: tasks[1].id, memberId: leo.id, week: WEEK });
    state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children[0]).toMatchObject({ balance: 2 });

    // Une demande refusée peut être renvoyée.
    await request(app).post("/stars/claims").set(childAuth).send({ taskId: tasks[1].id, week: WEEK });
    const pending = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body.claims.find((c: { status: string }) => c.status === "pending");
    expect((await request(app).post(`/stars/claims/${pending.id}/decline`).set(auth).send({ note: "Le lit n'est pas fait" })).status).toBe(204);
    expect(sent.some((m) => m.body.includes("Le lit n'est pas fait"))).toBe(true);
    expect((await request(app).post("/stars/claims").set(childAuth).send({ taskId: tasks[1].id, week: WEEK })).status).toBe(201);
  });
});
