import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";
import { childAllowed } from "../../src/lib/childAccess";

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
