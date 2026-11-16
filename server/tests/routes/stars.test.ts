import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { isChild, isMondayKey } from "../../src/lib/stars";
import { authHeader, signup } from "../helpers";

const WEEK = "2026-11-16"; // un lundi

async function setup() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const leo = (await request(app).post("/members").set(auth).send({ name: "Léo", age: 9 })).body.member;
  const mum = (await request(app).post("/members").set(auth).send({ name: "Maman", age: 40 })).body.member;
  const task = (
    await request(app)
      .post("/tasks")
      .set(auth)
      .send({ title: "Ranger sa chambre", category: "Maison", weekday: 2, time: "18:00", stars: 3, memberIds: [leo.id, mum.id] })
  ).body.task;
  return { auth, leo, mum, task };
}

describe("stars helpers", () => {
  it("knows a Monday and a child", () => {
    expect(isMondayKey(WEEK)).toBe(true);
    expect(isMondayKey("2026-11-17")).toBe(false);
    expect(isMondayKey("2026-02-30")).toBe(false);
    expect(isChild({ age: 14, birthday: null })).toBe(true);
    expect(isChild({ age: 15, birthday: null })).toBe(false);
    expect(isChild({ age: null, birthday: new Date("2020-01-01") }, new Date("2026-11-15"))).toBe(true);
    expect(isChild({ age: null, birthday: null })).toBe(false);
  });
});

describe("/stars", () => {
  it("gives a child the task's stars once per week, and can undo", async () => {
    const { auth, leo, task } = await setup();
    expect(task.stars).toBe(3);

    expect((await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: WEEK })).status).toBe(201);
    await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: WEEK });
    await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: "2026-11-23" });

    let state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children).toEqual([{ memberId: leo.id, balance: 6, weekStars: 3 }]);
    expect(state.completions).toEqual([{ taskId: task.id, memberId: leo.id, stars: 3 }]);

    await request(app).delete("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: WEEK });
    state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children[0]).toMatchObject({ balance: 3, weekStars: 0 });
  });

  it("refuses adults, unassigned tasks and bad weeks", async () => {
    const { auth, leo, mum, task } = await setup();
    expect((await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: mum.id, week: WEEK })).status).toBe(400);
    expect((await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: "2026-11-18" })).status).toBe(400);
    const other = (await request(app).post("/tasks").set(auth).send({ title: "Courses", category: "Maison", weekday: 1, time: "10:00" })).body.task;
    expect((await request(app).post("/stars/complete").set(auth).send({ taskId: other.id, memberId: leo.id, week: WEEK })).status).toBe(400);
  });

  it("exchanges stars for a reward only when there are enough, and keeps earned stars after the task is deleted", async () => {
    const { auth, leo, task } = await setup();
    const reward = (await request(app).post("/stars/rewards").set(auth).send({ title: "Sortie cinéma", cost: 5 })).body.reward;

    await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: WEEK });
    const tooEarly = await request(app).post(`/stars/rewards/${reward.id}/redeem`).set(auth).send({ memberId: leo.id });
    expect(tooEarly.status).toBe(409);
    expect(tooEarly.body.error).toBe("Il manque 2 étoiles.");

    await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: leo.id, week: "2026-11-23" });
    const ok = await request(app).post(`/stars/rewards/${reward.id}/redeem`).set(auth).send({ memberId: leo.id });
    expect(ok.body.balance).toBe(1);

    await request(app).delete(`/tasks/${task.id}`).set(auth);
    const state = (await request(app).get(`/stars?week=${WEEK}`).set(auth)).body;
    expect(state.children[0].balance).toBe(1);
    expect(state.history.map((h: { kind: string; title: string }) => `${h.kind}:${h.title}`)).toEqual([
      "spent:Sortie cinéma",
      "earned:Ranger sa chambre",
      "earned:Ranger sa chambre",
    ]);

    const spent = state.history[0];
    await request(app).delete(`/stars/history/${spent.id}`).set(auth);
    expect((await request(app).get(`/stars?week=${WEEK}`).set(auth)).body.children[0].balance).toBe(6);
  });
});
