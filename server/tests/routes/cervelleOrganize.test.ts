import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { addDays, mondayOf, parisDay } from "../../src/lib/cervelle/days";
import { authHeader, signup } from "../helpers";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

async function family(name = "Léa", level = "college") {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name, level });
  expect(created.status).toBe(201);
  const learnerId = created.body.learner.id as string;
  const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
  const login = await request(app).post("/cervelle/child/login").send({ code: code.body.code });
  return { auth, learnerId, child: { Authorization: `Bearer ${login.body.token}` }, url: `/cervelle/learners/${learnerId}` };
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
});
afterEach(() => {
  vi.restoreAllMocks();
  env.anthropicApiKey = "";
});

describe("Cervelle — minuteur", () => {
  it("defaults by level, can be changed, and pays only real sessions", async () => {
    const { child, url, auth } = await family("Tom", "primaire");
    const home = await request(app).get("/cervelle/learners/me/home").set(child);
    expect(home.body.learner.timer).toEqual({ focus: 15, pause: 5 });
    expect(home.body.missions.list.map((m: { id: string }) => m.id)).toContain("minuteur");

    const prefs = await request(app).patch("/cervelle/learners/me/timer").set(child).send({ focus: 20, pause: 4 });
    expect(prefs.body.learner.timer).toEqual({ focus: 20, pause: 4 });
    expect((await request(app).patch("/cervelle/learners/me/timer").set(child).send({ focus: 200, pause: 4 })).status).toBe(400);

    const short = await request(app).post("/cervelle/learners/me/focus").set(child).send({ seconds: 120 });
    expect(short.body).toMatchObject({ coins: 0, xp: 0, counted: false });
    expect(short.body.learner.streak).toBe(0);

    const real = await request(app).post("/cervelle/learners/me/focus").set(child).send({ seconds: 20 * 60, label: "Tables de 7" });
    expect(real.body).toMatchObject({ coins: 4, xp: 40, counted: true, streakIncreased: true });
    expect(real.body.learner).toMatchObject({ streak: 1, coins: 4 });
    expect(real.body.missions.list.find((m: { id: string }) => m.id === "minuteur").done).toBe(true);

    const overview = await request(app).get(`${url}/overview`).set(auth);
    expect(overview.body.recentSessions[0]).toMatchObject({ mode: "minuteur", revisionTitle: "Tables de 7" });

    const stats = await request(app).get("/cervelle/learners/me/stats").set(child);
    expect(stats.body.days).toHaveLength(84);
    expect(stats.body.week.at(-1)).toMatchObject({ day: parisDay(), minutes: 22 });
    expect(stats.body.totals).toMatchObject({ sessions: 2, weekMinutes: 22, activeDays: 1, streak: 1 });
    expect(stats.body.subjects).toEqual([
      { subject: "Tables de 7", minutes: 20 },
      { subject: "Minuteur", minutes: 2 },
    ]);
  });

  it("stores the « Quel élève es-tu ? » result", async () => {
    const { child } = await family();
    const res = await request(app)
      .put("/cervelle/learners/me/study-profile")
      .set(child)
      .send({ profile: "explorateur", scores: { organisation: 40, concentration: 70 }, methods: ["pomodoro", "cartes"] });
    expect(res.status).toBe(200);
    expect(res.body.learner.studyProfile).toMatchObject({ profile: "explorateur", methods: ["pomodoro", "cartes"] });
  });
});

describe("Cervelle — tâches, habitudes, journal", () => {
  it("rewards a ticked task once, and takes it back when unticked", async () => {
    const { child, auth, url } = await family();
    const created = await request(app).post("/cervelle/learners/me/todos").set(child).send({ title: "DM de SVT", urgent: true, important: true, dueDay: "2099-01-01" });
    expect(created.status).toBe(201);
    expect(created.body.todo).toMatchObject({ title: "DM de SVT", urgent: true, done: false, createdBy: "enfant" });
    // A parent can add one too.
    const byParent = await request(app).post(`${url}/todos`).set(auth).send({ title: "Ranger ta chambre", important: false });
    expect(byParent.body.todo.createdBy).toBe("parent");

    const id = created.body.todo.id;
    const done = await request(app).patch(`/cervelle/learners/me/todos/${id}`).set(child).send({ done: true });
    expect(done.body).toMatchObject({ coins: 2, xp: 10, todo: { done: true } });
    expect(done.body.learner.coins).toBe(2);
    // Ticking again changes nothing.
    const again = await request(app).patch(`/cervelle/learners/me/todos/${id}`).set(child).send({ done: true });
    expect(again.body.coins).toBe(0);
    const undone = await request(app).patch(`/cervelle/learners/me/todos/${id}`).set(child).send({ done: false });
    expect(undone.body.learner.coins).toBe(0);
    expect(undone.body.todo.done).toBe(false);

    const list = await request(app).get("/cervelle/learners/me/todos").set(child);
    expect(list.body.todos).toHaveLength(2);
    await request(app).delete(`/cervelle/learners/me/todos/${id}`).set(child);
    expect((await request(app).get("/cervelle/learners/me/todos").set(child)).body.todos).toHaveLength(1);
  });

  it("ticks habits for today (rewarded) or yesterday, and unticks them", async () => {
    const { child } = await family();
    const h = await request(app).post("/cervelle/learners/me/habits").set(child).send({ title: "Lire 20 min", emoji: "📖", days: [4, 0, 0, 2] });
    expect(h.status).toBe(201);
    expect(h.body.habit.days).toEqual([0, 2, 4]);
    const id = h.body.habit.id;
    const today = parisDay();

    const tick = await request(app).post(`/cervelle/learners/me/habits/${id}/check`).set(child).send({});
    expect(tick.body).toMatchObject({ coins: 1, xp: 5 });
    expect((await request(app).post(`/cervelle/learners/me/habits/${id}/check`).set(child).send({})).body.coins).toBe(0);
    const yesterday = await request(app).post(`/cervelle/learners/me/habits/${id}/check`).set(child).send({ day: addDays(today, -1) });
    expect(yesterday.body.coins).toBe(0);
    expect((await request(app).post(`/cervelle/learners/me/habits/${id}/check`).set(child).send({ day: addDays(today, -3) })).status).toBe(400);

    const list = await request(app).get("/cervelle/learners/me/habits").set(child);
    expect(list.body.habits[0].checked).toEqual([addDays(today, -1), today]);
    const untick = await request(app).delete(`/cervelle/learners/me/habits/${id}/check?day=${today}`).set(child);
    expect(untick.body.learner.coins).toBe(0);

    await request(app).delete(`/cervelle/learners/me/habits/${id}`).set(child);
    expect((await request(app).get("/cervelle/learners/me/habits").set(child)).body.habits).toHaveLength(0);
  });

  it("keeps a journal for the last days only", async () => {
    const { child, auth, url } = await family();
    const today = parisDay();
    const w = await request(app).put(`/cervelle/learners/me/journal/${today}`).set(child).send({ mood: 5, learned: "Les fractions", proud: "Mon exposé" });
    expect(w.status).toBe(200);
    await request(app).put(`/cervelle/learners/me/journal/${today}`).set(child).send({ mood: 3, learned: "Les fractions" });
    expect((await request(app).put(`/cervelle/learners/me/journal/${addDays(today, -10)}`).set(child).send({ mood: 3 })).status).toBe(400);
    expect((await request(app).put(`/cervelle/learners/me/journal/${today}`).set(child).send({ mood: 9 })).status).toBe(400);
    // The parent can read it (the app tells the child).
    const read = await request(app).get(`${url}/journal`).set(auth);
    expect(read.body.entries).toEqual([{ day: today, mood: 3, learned: "Les fractions", proud: "", hard: "" }]);
  });
});

describe("Cervelle — agenda", () => {
  it("adds slots, reads a timetable photo and saves the checked slots", async () => {
    const { child, auth, url } = await family();
    const one = await request(app).post("/cervelle/learners/me/agenda/events").set(child).send({ title: "Interro de maths", kind: "interro", day: "2099-03-02", start: "10:00", end: "11:00" });
    expect(one.status).toBe(201);
    expect((await request(app).post("/cervelle/learners/me/agenda/events").set(child).send({ title: "X", weekday: 1, day: "2099-03-02", start: "10:00", end: "11:00" })).status).toBe(400);
    expect((await request(app).post("/cervelle/learners/me/agenda/events").set(child).send({ title: "X", weekday: 1, start: "11:00", end: "10:00" })).status).toBe(400);

    vi.spyOn(ai, "readTimetable").mockResolvedValue([
      { weekday: 0, start: "08:00", end: "08:55", title: "Français", room: "2-004" },
      { weekday: 0, start: "09:00", end: "09:55", title: "Mathématiques", room: "" },
    ]);
    const read = await request(app).post("/cervelle/learners/me/agenda/timetable").set(child).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    expect(read.status).toBe(200);
    expect(read.body.slots).toHaveLength(2);

    const saved = await request(app).post("/cervelle/learners/me/agenda/events/bulk").set(child).send({ events: read.body.slots.map((s: ai.TimetableSlot) => ({ ...s, kind: "cours" })) });
    expect(saved.body.created).toBe(2);
    // Re-importing replaces the timetable, not the one-off slots.
    await request(app).post("/cervelle/learners/me/agenda/events/bulk").set(child).send({ replace: true, events: [{ title: "Anglais", weekday: 2, start: "14:00", end: "15:00" }] });
    const agenda = await request(app).get(`${url}/agenda`).set(auth);
    expect(agenda.body.events.map((e: { title: string }) => e.title).sort()).toEqual(["Anglais", "Interro de maths"]);
    expect(agenda.body.canSync).toBe(false);

    const id = one.body.event.id;
    const moved = await request(app).patch(`/cervelle/learners/me/agenda/events/${id}`).set(child).send({ start: "13:30", end: "14:25" });
    expect(moved.body.event).toMatchObject({ start: "13:30", end: "14:25", day: "2099-03-02" });
    await request(app).delete(`/cervelle/learners/me/agenda/events/${id}`).set(child);
    expect((await request(app).get(`${url}/agenda`).set(auth)).body.events).toHaveLength(1);
  });

  it("synchronises with Passerelle's planning both ways, only when a parent asks", async () => {
    const { child, auth, url, learnerId } = await family();
    expect((await request(app).post("/cervelle/learners/me/agenda/sync").set(child)).status).toBe(403);
    expect((await request(app).post(`${url}/agenda/sync`).set(auth)).body.code).toBe("no_member");

    const member = await request(app).post("/members").set(auth).send({ name: "Léa", tint: "accent" });
    const memberId = member.body.member.id;
    await request(app).patch(`${url}`).set(auth).send({ memberId });
    await request(app).post(`${url}/agenda/events`).set(auth).send({ title: "Français", weekday: 0, start: "08:00", end: "08:55", room: "2-004" });
    const task = await request(app)
      .post("/tasks")
      .set(auth)
      .send({ title: "Piscine", category: "Loisirs", weekday: 2, time: "17:00", duration: 60, recurring: true, memberIds: [memberId] });
    expect(task.status).toBe(201);

    const sync = await request(app).post(`${url}/agenda/sync`).set(auth).send({ direction: "both" });
    expect(sync.body).toEqual({ pushed: 1, pulled: 1, removed: 0 });
    const tasks = await prisma.task.findMany({ where: { members: { some: { memberId } } }, orderBy: { title: "asc" } });
    expect(tasks.map((t) => [t.title, t.category, t.time, t.duration, t.recurring])).toEqual([
      ["Français", "École", "08:00", 55, true],
      ["Piscine", "Loisirs", "17:00", 60, true],
    ]);
    const agenda = await request(app).get(`${url}/agenda`).set(auth);
    expect(agenda.body.events.find((e: { title: string }) => e.title === "Piscine")).toMatchObject({ source: "passerelle", category: "Loisirs", weekday: 2, start: "17:00", end: "18:00" });

    // Again: nothing duplicated. Then the task goes away in Passerelle.
    expect((await request(app).post(`${url}/agenda/sync`).set(auth)).body).toEqual({ pushed: 1, pulled: 1, removed: 0 });
    await prisma.task.delete({ where: { id: task.body.task.id } });
    expect((await request(app).post(`${url}/agenda/sync`).set(auth).send({ direction: "from_passerelle" })).body).toEqual({ pushed: 0, pulled: 0, removed: 1 });
    expect(await prisma.task.count({ where: { userId: (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).userId } })).toBe(1);
  });
});

describe("Cervelle — amis", () => {
  it("needs both parents' yes, then shares a weekly board, cheers and challenges", async () => {
    const a = await family("Léa");
    const b = await family("Hugo");
    const codeB = (await request(app).get("/cervelle/learners/me/friends").set(b.child)).body.code;
    expect(codeB).toMatch(/^[A-Z2-9]{6}$/);

    expect((await request(app).post("/cervelle/learners/me/friends").set(a.child).send({ code: "zzzzzz" })).status).toBe(404);
    const ask = await request(app).post("/cervelle/learners/me/friends").set(a.child).send({ code: codeB.toLowerCase() });
    expect(ask.status).toBe(201);
    expect((await request(app).post("/cervelle/learners/me/friends").set(a.child).send({ code: codeB })).status).toBe(409);

    // Not friends yet: Hugo isn't on Léa's board and can't be cheered.
    let board = (await request(app).get("/cervelle/learners/me/friends").set(a.child)).body;
    expect(board.board.map((x: { name: string }) => x.name)).toEqual(["Léa"]);
    expect(board.pending).toEqual([{ id: ask.body.friendship.id, name: "Hugo", outgoing: true }]);
    expect((await request(app).post("/cervelle/learners/me/cheers").set(a.child).send({ toId: b.learnerId, kind: "bravo" })).status).toBe(404);

    // Each parent sees the request and says yes.
    const reqA = await request(app).get("/cervelle/friend-requests").set(a.auth);
    expect(reqA.body.requests[0]).toMatchObject({ child: { name: "Léa" }, other: { name: "Hugo" }, outgoing: true, otherApproved: false });
    expect((await request(app).get("/cervelle/friend-requests").set(a.child)).status).toBe(403);
    expect((await request(app).post(`/cervelle/friend-requests/${reqA.body.requests[0].id}/approve`).set(a.auth)).body.friends).toBe(false);
    const reqB = await request(app).get("/cervelle/friend-requests").set(b.auth);
    expect(reqB.body.requests[0]).toMatchObject({ child: { name: "Hugo" }, other: { name: "Léa" }, outgoing: false, otherApproved: true });
    expect((await request(app).post(`/cervelle/friend-requests/${reqB.body.requests[0].id}/approve`).set(b.auth)).body.friends).toBe(true);

    await request(app).post("/cervelle/learners/me/focus").set(b.child).send({ seconds: 30 * 60 });
    board = (await request(app).get("/cervelle/learners/me/friends").set(a.child)).body;
    expect(board.board.map((x: { name: string; weekMinutes: number }) => [x.name, x.weekMinutes])).toEqual([
      ["Hugo", 30],
      ["Léa", 0],
    ]);
    expect(Object.keys(board.board[0]).sort()).toEqual(["color", "equipped", "friendshipId", "id", "level", "me", "name", "sibling", "weekMinutes"]);

    // Ready-made cheers only.
    expect((await request(app).post("/cervelle/learners/me/cheers").set(a.child).send({ toId: b.learnerId, kind: "texte libre" })).status).toBe(400);
    expect((await request(app).post("/cervelle/learners/me/cheers").set(a.child).send({ toId: b.learnerId, kind: "bravo" })).status).toBe(201);
    const got = (await request(app).get("/cervelle/learners/me/friends").set(b.child)).body.cheers;
    expect(got[0]).toMatchObject({ fromName: "Léa", emoji: "👏", label: "Bravo !" });
    await request(app).post("/cervelle/learners/me/cheers/seen").set(b.child);
    expect((await request(app).get("/cervelle/learners/me/friends").set(b.child)).body.cheers).toEqual([]);

    // A challenge: Hugo accepts; at the end of the week the winner is paid once.
    const ch = await request(app).post("/cervelle/learners/me/challenges").set(a.child).send({ toId: b.learnerId });
    expect(ch.status).toBe(201);
    expect((await request(app).post("/cervelle/learners/me/challenges").set(b.child).send({ toId: a.learnerId })).status).toBe(409);
    expect((await request(app).post(`/cervelle/learners/me/challenges/${ch.body.challenge.id}/accept`).set(a.child)).status).toBe(404);
    expect((await request(app).post(`/cervelle/learners/me/challenges/${ch.body.challenge.id}/accept`).set(b.child)).status).toBe(204);
    const live = (await request(app).get("/cervelle/learners/me/friends").set(a.child)).body.challenges[0];
    expect(live).toMatchObject({ status: "active", myMinutes: 0, theirMinutes: 30, result: null });

    const lastWeek = addDays(mondayOf(parisDay()), -7);
    await prisma.challenge.update({ where: { id: ch.body.challenge.id }, data: { week: lastWeek } });
    await prisma.studySession.updateMany({ where: { learnerId: b.learnerId }, data: { day: addDays(lastWeek, 2) } });
    const coinsBefore = (await prisma.learner.findUniqueOrThrow({ where: { id: b.learnerId } })).coins;
    const after = (await request(app).get("/cervelle/learners/me/friends").set(b.child)).body.challenges[0];
    expect(after).toMatchObject({ status: "done", result: "won", myMinutes: 30, theirMinutes: 0 });
    await request(app).get("/cervelle/learners/me/friends").set(a.child);
    expect((await prisma.learner.findUniqueOrThrow({ where: { id: b.learnerId } })).coins).toBe(coinsBefore + 20);
  });

  it("puts brothers and sisters on the board without asking", async () => {
    const a = await family("Léa");
    const sib = await request(app).post("/cervelle/learners").set(a.auth).send({ name: "Noé", level: "primaire" });
    const board = (await request(app).get("/cervelle/learners/me/friends").set(a.child)).body.board;
    expect(board.map((x: { name: string; sibling: boolean }) => [x.name, x.sibling])).toEqual([
      ["Léa", false],
      ["Noé", true],
    ]);
    const code = (await request(app).get(`/cervelle/learners/${sib.body.learner.id}/friends`).set(a.auth)).body.code;
    expect((await request(app).post("/cervelle/learners/me/friends").set(a.child).send({ code })).status).toBe(400);
  });
});
