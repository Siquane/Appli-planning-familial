import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

const baseTask = {
  title: "Devoirs de Léo",
  category: "École" as const,
  weekday: 1,
  time: "17:00",
  duration: 30,
  priority: "high" as const,
};

describe("tasks CRUD", () => {
  it("creates, lists, patches and deletes a task, persisting memberIds", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const member = await request(app).post("/members").set(auth).send({ name: "Léo" });
    const memberId = member.body.member.id;

    const created = await request(app).post("/tasks").set(auth).send({ ...baseTask, memberIds: [memberId] });
    expect(created.status).toBe(201);
    expect(created.body.task).toMatchObject({ title: baseTask.title, weekday: 1, memberIds: [memberId] });
    const taskId = created.body.task.id;

    const list = await request(app).get("/tasks").set(auth);
    expect(list.body.tasks).toHaveLength(1);

    const patched = await request(app).patch(`/tasks/${taskId}`).set(auth).send({ time: "18:00", memberIds: [] });
    expect(patched.status).toBe(200);
    expect(patched.body.task.time).toBe("18:00");
    expect(patched.body.task.memberIds).toEqual([]);

    const deleted = await request(app).delete(`/tasks/${taskId}`).set(auth);
    expect(deleted.status).toBe(204);

    const listAfter = await request(app).get("/tasks").set(auth);
    expect(listAfter.body.tasks).toHaveLength(0);
  });

  it("persists the recurring and reminder flags", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/tasks").set(auth).send({ ...baseTask, recurring: true, reminder: true });
    expect(created.status).toBe(201);
    expect(created.body.task).toMatchObject({ recurring: true, reminder: true });

    const patched = await request(app).patch(`/tasks/${created.body.task.id}`).set(auth).send({ reminder: false });
    expect(patched.body.task).toMatchObject({ recurring: true, reminder: false });
  });

  it("links the days of a task with a seriesId, kept when another field changes", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const mon = await request(app).post("/tasks").set(auth).send({ ...baseTask, weekday: 0, seriesId: "s_abc12345" });
    const wed = await request(app).post("/tasks").set(auth).send({ ...baseTask, weekday: 2, seriesId: "s_abc12345" });
    expect(mon.body.task.seriesId).toBe("s_abc12345");
    expect(wed.body.task.seriesId).toBe("s_abc12345");

    const patched = await request(app).patch(`/tasks/${mon.body.task.id}`).set(auth).send({ title: "Sport" });
    expect(patched.body.task.seriesId).toBe("s_abc12345");

    const single = await request(app).post("/tasks").set(auth).send(baseTask);
    expect(single.body.task.seriesId).toBeNull();

    const bad = await request(app).post("/tasks").set(auth).send({ ...baseTask, seriesId: "x y" });
    expect(bad.status).toBe(400);
  });

  it("keeps a task in the digests unless it is unticked", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const created = await request(app).post("/tasks").set(auth).send(baseTask);
    expect(created.body.task.inDigest).toBe(true);
    const patched = await request(app).patch(`/tasks/${created.body.task.id}`).set(auth).send({ inDigest: false });
    expect(patched.body.task.inDigest).toBe(false);
    const other = await request(app).patch(`/tasks/${created.body.task.id}`).set(auth).send({ title: "Autre" });
    expect(other.body.task.inDigest).toBe(false);
  });

  it("rejects an invalid payload", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app)
      .post("/tasks")
      .set(authHeader(accessToken))
      .send({ ...baseTask, category: "Not-A-Category" });
    expect(res.status).toBe(400);
  });

  it("isolates tasks between users", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });

    const created = await request(app).post("/tasks").set(authHeader(userA.accessToken)).send(baseTask);
    const taskId = created.body.task.id;

    const listAsB = await request(app).get("/tasks").set(authHeader(userB.accessToken));
    expect(listAsB.body.tasks).toHaveLength(0);

    const deleteAsB = await request(app).delete(`/tasks/${taskId}`).set(authHeader(userB.accessToken));
    expect(deleteAsB.status).toBe(404);
  });
});

describe("POST /tasks/auto-slot", () => {
  it("scores a draft task and returns its best weekday/time, without persisting anything", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const res = await request(app).post("/tasks/auto-slot").set(auth).send({ priority: "high" });
    expect(res.status).toBe(200);
    expect(res.body.weekday).toBeGreaterThanOrEqual(0);
    expect(res.body.weekday).toBeLessThanOrEqual(6);
    expect(res.body.time).toMatch(/^\d{2}:\d{2}$/);
    expect(res.body.reasons.length).toBeGreaterThan(0);

    const list = await request(app).get("/tasks").set(auth);
    expect(list.body.tasks).toHaveLength(0);
  });

  it("avoids conflicting with an existing task for the same member", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const member = await request(app).post("/members").set(auth).send({ name: "Léo" });
    const memberId = member.body.member.id;

    await request(app).post("/tasks").set(auth).send({ ...baseTask, weekday: 0, time: "08:00", memberIds: [memberId] });

    const res = await request(app).post("/tasks/auto-slot").set(auth).send({ priority: "high", memberIds: [memberId] });
    expect(res.status).toBe(200);
    expect(res.body.weekday === 0 && res.body.time === "08:00").toBe(false);
  });
});

describe("GET /tasks/replan/proposals", () => {
  it("returns proposals only for flexible tasks", async () => {
    // Signup already creates a default Constraints row for the user (see
    // src/routes/auth.ts: `constraints: { create: {} }`), so no separate
    // GET /constraints warm-up is needed here.
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    await request(app).post("/tasks").set(auth).send({ ...baseTask, title: "Rigide", flexible: false });
    await request(app).post("/tasks").set(auth).send({ ...baseTask, title: "Flexible", flexible: true, priority: "high" });

    const res = await request(app).get("/tasks/replan/proposals").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.proposals).toHaveLength(1);
    expect(res.body.proposals[0].title).toBe("Flexible");
    expect(res.body.proposals[0].candidates.length).toBeGreaterThan(0);
  });

  it("leaves out a flexible task already ticked done this week", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const done = (await request(app).post("/tasks").set(auth).send({ ...baseTask, category: "Maison", title: "Faite", flexible: true })).body.task;
    await request(app).post("/tasks").set(auth).send({ ...baseTask, title: "À faire", flexible: true });
    const { mondayOf, parisDay } = await import("../../src/lib/cervelle/days");
    await request(app).put(`/tasks/${done.id}/done`).set(auth).send({ day: mondayOf(parisDay()) });

    const res = await request(app).get("/tasks/replan/proposals").set(auth);
    expect(res.body.proposals.map((p: { title: string }) => p.title)).toEqual(["À faire"]);
  });

  it("avoids the account's working hours", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app).patch("/constraints").set(auth).send({ workDays: [0, 1, 2, 3, 4], workStart: "09:00", workEnd: "17:30" });
    await request(app).post("/tasks").set(auth).send({ ...baseTask, title: "Clé des poubelles", flexible: true, priority: "high" });

    const res = await request(app).get("/tasks/replan/proposals").set(auth);
    const candidates: { weekday: number; time: string }[] = res.body.proposals[0].candidates;
    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      if (c.weekday <= 4) expect(c.time < "09:00" || c.time >= "17:30").toBe(true);
    }
  });
});

describe("tasks done", () => {
  const WEEK = "2026-11-16"; // un lundi

  it("refuses to tick a School or Work task", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    for (const category of ["École", "Travail"]) {
      const task = (await request(app).post("/tasks").set(auth).send({ title: "Créneau", category, weekday: 1, time: "08:30" })).body.task;
      expect((await request(app).put(`/tasks/${task.id}/done`).set(auth).send({ day: "2026-11-17" })).status).toBe(400);
    }
  });

  it("ticks a task for one day, lists the week, and unticks it", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const task = (await request(app).post("/tasks").set(auth).send({ title: "Courses", category: "Maison", weekday: 1, time: "18:00", recurring: true })).body.task;

    expect((await request(app).put(`/tasks/${task.id}/done`).set(auth).send({ day: "2026-11-17" })).status).toBe(204);
    // Cocher deux fois ne crée pas de doublon.
    expect((await request(app).put(`/tasks/${task.id}/done`).set(auth).send({ day: "2026-11-17" })).status).toBe(204);
    // La semaine suivante ne compte pas.
    await request(app).put(`/tasks/${task.id}/done`).set(auth).send({ day: "2026-11-24" });

    let res = await request(app).get(`/tasks/done?week=${WEEK}`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.done).toEqual([{ taskId: task.id, day: "2026-11-17" }]);

    expect((await request(app).delete(`/tasks/${task.id}/done?day=2026-11-17`).set(auth)).status).toBe(204);
    res = await request(app).get(`/tasks/done?week=${WEEK}`).set(auth);
    expect(res.body.done).toEqual([]);
  });

  it("rejects bad days and other families' tasks", async () => {
    const a = authHeader((await signup(app)).accessToken);
    const b = authHeader((await signup(app)).accessToken);
    const task = (await request(app).post("/tasks").set(a).send({ title: "Courses", category: "Maison", weekday: 1, time: "18:00" })).body.task;

    expect((await request(app).put(`/tasks/${task.id}/done`).set(a).send({ day: "2026-02-30" })).status).toBe(400);
    expect((await request(app).get("/tasks/done?week=2026-11-17").set(a)).status).toBe(400);
    expect((await request(app).put(`/tasks/${task.id}/done`).set(b).send({ day: "2026-11-17" })).status).toBe(404);
    expect((await request(app).delete(`/tasks/${task.id}/done?day=2026-11-17`).set(b)).status).toBe(404);
  });
});

describe("appointments", () => {
  it("stores a dated appointment and derives its weekday", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    // 3 décembre 2026 = un jeudi.
    const res = await request(app)
      .post("/tasks")
      .set(auth)
      .send({ ...baseTask, title: "Dentiste", weekday: 0, appointmentDate: "2026-12-03", location: "Cabinet Dupont", remind: "eve", recurring: true, flexible: true });
    expect(res.status).toBe(201);
    expect(res.body.task).toMatchObject({ weekday: 3, appointmentDate: "2026-12-03", location: "Cabinet Dupont", remind: "eve", recurring: false, flexible: false });

    const moved = await request(app).patch(`/tasks/${res.body.task.id}`).set(auth).send({ appointmentDate: "2026-12-07" });
    expect(moved.body.task).toMatchObject({ weekday: 0, appointmentDate: "2026-12-07", location: "Cabinet Dupont" });
  });

  it("rejects an impossible date", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/tasks").set(authHeader(accessToken)).send({ ...baseTask, appointmentDate: "2026-02-30" });
    expect(res.status).toBe(400);
  });

  it("an ordinary task has no date", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/tasks").set(authHeader(accessToken)).send({ ...baseTask, remind: "hour" });
    expect(res.body.task).toMatchObject({ appointmentDate: null, location: "", remind: null });
  });
});
