import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";
import { childAllowed } from "../../src/lib/childAccess";
import { setPushSender, type PushMessage } from "../../src/lib/familyAlerts";

async function familyWithChild(age = 10) {
  const parent = await signup(app);
  const auth = authHeader(parent.accessToken);
  const member = (await request(app).post("/members").set(auth).send({ name: "Jules", initials: "J", age })).body.member;
  return { parent, auth, member };
}

async function childLogin(auth: Record<string, string>, memberId: string) {
  const code = (await request(app).post(`/family/children/${memberId}/code`).set(auth)).body.code;
  const res = await request(app).post("/auth/child-code").send({ code });
  return { code, res, childAuth: authHeader(res.body.accessToken) };
}

describe("child accounts", () => {
  it("a parent gives a one-time code, the child signs in with it", async () => {
    const { auth, member } = await familyWithChild();
    const list = await request(app).get("/family/children").set(auth);
    expect(list.body.children).toEqual([expect.objectContaining({ memberId: member.id, accountId: null, problem: null })]);

    const created = await request(app).post(`/family/children/${member.id}/code`).set(auth);
    expect(created.status).toBe(201);
    expect(created.body.code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);

    const login = await request(app).post("/auth/child-code").send({ code: created.body.code.toLowerCase().replace("-", " ") });
    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ name: "Jules", familyRole: "child", childMemberId: member.id, email: "" });

    // À usage unique.
    expect((await request(app).post("/auth/child-code").send({ code: created.body.code })).status).toBe(401);
    // Un nouveau code reconnecte le même compte.
    const again = await childLogin(auth, member.id);
    expect(again.res.body.user.id).toBe(login.body.user.id);
  });

  it("refuses a code that expired", async () => {
    const { auth, member } = await familyWithChild();
    const { code } = (await request(app).post(`/family/children/${member.id}/code`).set(auth)).body;
    await prisma.childLoginCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).post("/auth/child-code").send({ code })).status).toBe(401);
  });

  it("needs an age between 8 and 14", async () => {
    const parent = await signup(app);
    const auth = authHeader(parent.accessToken);
    const noAge = (await request(app).post("/members").set(auth).send({ name: "Léo", initials: "L" })).body.member;
    const tooYoung = (await request(app).post("/members").set(auth).send({ name: "Bébé", initials: "B", age: 5 })).body.member;
    const teen = (await request(app).post("/members").set(auth).send({ name: "Ado", initials: "A", age: 16 })).body.member;
    expect((await request(app).post(`/family/children/${noAge.id}/code`).set(auth)).body.code).toBe("child_unknown");
    expect((await request(app).post(`/family/children/${tooYoung.id}/code`).set(auth)).status).toBe(400);
    expect((await request(app).post(`/family/children/${teen.id}/code`).set(auth)).body.code).toBe("child_too_old");
  });

  it("the child shares the planning but has their own budget and cannot manage the family", async () => {
    const { auth, member } = await familyWithChild();
    expect((await request(app).post("/expenses").set(auth).send({ label: "Courses parents", amountCents: 5000, category: "courses", date: "2026-11-10" })).status).toBe(201);
    const parentTask = (await request(app).post("/tasks").set(auth).send({ title: "Réunion", category: "Travail", weekday: 1, time: "09:00" })).body.task;
    const { childAuth } = await childLogin(auth, member.id);

    // Planning partagé.
    const tasks = await request(app).get("/tasks").set(childAuth);
    expect(tasks.body.tasks.map((t: { title: string }) => t.title)).toContain("Réunion");
    // Il ajoute sa tâche et peut la modifier ; pas celle des parents.
    const own = (await request(app).post("/tasks").set(childAuth).send({ title: "Foot", category: "Loisirs", weekday: 2, time: "17:00", memberIds: [member.id] })).body.task;
    expect((await request(app).patch(`/tasks/${own.id}`).set(childAuth).send({ time: "17:30" })).status).toBe(200);
    expect((await request(app).patch(`/tasks/${parentTask.id}`).set(childAuth).send({ time: "10:00" })).status).toBe(403);
    expect((await request(app).delete(`/tasks/${parentTask.id}`).set(childAuth)).status).toBe(403);

    // Budget à lui : il ne voit pas les dépenses des parents.
    expect(JSON.stringify((await request(app).get("/expenses?month=2026-11").set(auth)).body)).toContain("Courses parents");
    const expenses = await request(app).get("/expenses?month=2026-11").set(childAuth);
    expect(expenses.status).toBe(200);
    expect(JSON.stringify(expenses.body)).not.toContain("Courses parents");

    // Gestion de la famille, repas, étoiles : refusé.
    expect((await request(app).post("/members").set(childAuth).send({ name: "X", initials: "X" })).status).toBe(403);
    expect((await request(app).post("/family/invite").set(childAuth).send({ role: "full" })).status).toBe(403);
    expect((await request(app).post(`/family/children/${member.id}/code`).set(childAuth)).status).toBe(403);
    expect((await request(app).post("/shopping").set(childAuth).send({ name: "Chips" })).status).toBe(403);
    expect((await request(app).get("/share/members").set(childAuth)).status).toBe(403);
  });

  it("removing the access or the member deletes the child account", async () => {
    const { auth, member } = await familyWithChild();
    const { res } = await childLogin(auth, member.id);
    expect((await request(app).delete(`/family/children/${member.id}`).set(auth)).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: res.body.user.id } })).toBeNull();

    const second = await childLogin(auth, member.id);
    await request(app).delete(`/members/${member.id}`).set(auth);
    expect(await prisma.user.findUnique({ where: { id: second.res.body.user.id } })).toBeNull();
  });

  it("child accounts leave with a family that nobody takes over", async () => {
    const { parent, auth, member } = await familyWithChild();
    const { res } = await childLogin(auth, member.id);
    expect((await request(app).delete("/auth/me").set(auth).send({ password: "password123", confirmFamily: true })).status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: res.body.user.id } })).toBeNull();
    expect(parent).toBeTruthy();
  });
});

describe("parents see the child's space", () => {
  it("an adult reads and writes the child's budget with X-Child-Space; the child sees it too", async () => {
    const { auth, member } = await familyWithChild();
    const { childAuth } = await childLogin(auth, member.id);
    expect((await request(app).post("/expenses").set(childAuth).send({ label: "Bonbons", amountCents: 250, category: "loisirs", date: "2026-11-10" })).status).toBe(201);

    const space = { ...auth, "X-Child-Space": member.id };
    const seen = await request(app).get("/expenses?month=2026-11").set(space);
    expect(JSON.stringify(seen.body)).toContain("Bonbons");
    // Sans l'en-tête, le parent voit son propre budget.
    expect(JSON.stringify((await request(app).get("/expenses?month=2026-11").set(auth)).body)).not.toContain("Bonbons");

    expect((await request(app).post("/expenses").set(space).send({ label: "Argent de poche", amountCents: 500, category: "divers", date: "2026-11-11" })).status).toBe(201);
    expect(JSON.stringify((await request(app).get("/expenses?month=2026-11").set(childAuth)).body)).toContain("Argent de poche");
  });

  it("refuses the child's space to a « planning » account of the same family", async () => {
    const { auth, member } = await familyWithChild();
    const code = (await request(app).post("/family/invite").set(auth).send({ role: "planning" })).body.invite.code as string;
    const email = `planning${Date.now()}${Math.floor(Math.random() * 1e6)}@passerelle.test`;
    const joined = await request(app).post("/auth/signup").send({ email, password: "password123", name: "Léa", familyCode: code, age15: true });
    const res = await request(app).get("/expenses?month=2026-11").set({ ...authHeader(joined.body.accessToken), "X-Child-Space": member.id });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("child_space_forbidden");
  });

  it("refuses another family's child and a child using the header", async () => {
    const { auth, member } = await familyWithChild();
    const { childAuth } = await childLogin(auth, member.id);
    const stranger = await signup(app);
    expect((await request(app).get("/expenses?month=2026-11").set({ ...authHeader(stranger.accessToken), "X-Child-Space": member.id })).status).toBe(404);
    // L'en-tête n'a aucun effet pour un enfant (il reste dans son espace).
    expect((await request(app).get("/expenses?month=2026-11").set({ ...childAuth, "X-Child-Space": member.id })).status).toBe(200);
  });
});

describe("childAllowed", () => {
  it("reads everything but sharing and billing; writes only their own space", () => {
    expect(childAllowed("GET", "/tasks")).toBe(true);
    expect(childAllowed("GET", "/share/members")).toBe(false);
    expect(childAllowed("POST", "/tasks")).toBe(true);
    expect(childAllowed("POST", "/documents")).toBe(true);
    expect(childAllowed("POST", "/expenses")).toBe(true);
    expect(childAllowed("DELETE", "/family/notice")).toBe(true);
    expect(childAllowed("POST", "/family/leave")).toBe(false);
    expect(childAllowed("PUT", "/stars/toggle")).toBe(false);
    expect(childAllowed("POST", "/meals/generate")).toBe(false);
  });
});

describe("reward requests", () => {
  it("the child asks, the parent is notified and accepts; the child is told", async () => {
    const sent: PushMessage[] = [];
    setPushSender(async (m) => {
      sent.push(...m);
    });
    try {
      const { auth, member } = await familyWithChild();
      await request(app).put("/notifications/push-token").set(auth).send({ token: "ExponentPushToken[parent]" });
      const task = (await request(app).post("/tasks").set(auth).send({ title: "Ranger", category: "Maison", weekday: 1, time: "18:00", memberIds: [member.id], stars: 5 })).body.task;
      await request(app).post("/stars/complete").set(auth).send({ taskId: task.id, memberId: member.id, week: "2026-11-16" });
      const cheap = (await request(app).post("/stars/rewards").set(auth).send({ title: "Dessert", cost: 3 })).body.reward;
      const dear = (await request(app).post("/stars/rewards").set(auth).send({ title: "Cinéma", cost: 20 })).body.reward;
      const { childAuth } = await childLogin(auth, member.id);
      await request(app).put("/notifications/push-token").set(childAuth).send({ token: "ExponentPushToken[child]" });

      // Pas assez d'étoiles pour le cinéma.
      expect((await request(app).post(`/stars/rewards/${dear.id}/request`).set(childAuth)).body.code).toBe("not_enough_stars");
      const asked = await request(app).post(`/stars/rewards/${cheap.id}/request`).set(childAuth);
      expect(asked.status).toBe(201);
      expect((await request(app).post(`/stars/rewards/${cheap.id}/request`).set(childAuth)).body.code).toBe("already_requested");
      // Un adulte n'utilise pas cette route ; l'enfant ne peut pas accepter.
      expect((await request(app).post(`/stars/rewards/${cheap.id}/request`).set(auth)).status).toBe(403);
      expect((await request(app).post(`/stars/requests/${asked.body.request.id}/accept`).set(childAuth)).status).toBe(403);
      expect(sent.map((m) => [m.to, m.body])).toEqual([["ExponentPushToken[parent]", "Jules demande : Dessert (3 étoiles)."]]);

      const state = (await request(app).get("/stars?week=2026-11-16").set(auth)).body;
      expect(state.requests).toEqual([expect.objectContaining({ title: "Dessert", status: "pending", memberId: member.id })]);

      const accepted = await request(app).post(`/stars/requests/${asked.body.request.id}/accept`).set(auth);
      expect(accepted.body.balance).toBe(2);
      expect(sent.at(-1)).toMatchObject({ to: "ExponentPushToken[child]", body: "Accepté : Dessert ! Bravo 🎉" });
      expect((await request(app).post(`/stars/requests/${asked.body.request.id}/accept`).set(auth)).status).toBe(404);

      // Refus avec un petit mot.
      const again = (await request(app).post(`/stars/rewards/${cheap.id}/request`).set(childAuth));
      expect(again.status).toBe(409); // plus que 2 étoiles
      const mini = (await request(app).post("/stars/rewards").set(auth).send({ title: "Autocollant", cost: 1 })).body.reward;
      const asked2 = (await request(app).post(`/stars/rewards/${mini.id}/request`).set(childAuth)).body.request;
      expect((await request(app).post(`/stars/requests/${asked2.id}/decline`).set(auth).send({ note: "Ce week-end" })).status).toBe(204);
      expect(sent.at(-1)).toMatchObject({ to: "ExponentPushToken[child]", body: "Pas cette fois pour Autocollant : Ce week-end" });
      const childView = (await request(app).get("/stars?week=2026-11-16").set(childAuth)).body;
      expect(childView.requests.map((r: { status: string }) => r.status).sort()).toEqual(["accepted", "declined"]);
    } finally {
      setPushSender(null);
    }
  });
});
