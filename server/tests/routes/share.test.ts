import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("share", () => {
  it("creates a share link idempotently and lists shared people", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const first = await request(app).get("/share").set(auth);
    expect(first.status).toBe(200);
    expect(typeof first.body.shareToken).toBe("string");
    expect(first.body.sharedWith).toEqual([]);

    const second = await request(app).get("/share").set(auth);
    expect(second.body.shareToken).toBe(first.body.shareToken);
  });

  it("invites and removes a shared person", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const invited = await request(app).post("/share/people").set(auth).send({ name: "Marc", role: "Co-parent" });
    expect(invited.status).toBe(201);
    expect(invited.body.person).toMatchObject({ name: "Marc", role: "Co-parent" });

    const list = await request(app).get("/share").set(auth);
    expect(list.body.sharedWith).toHaveLength(1);

    const removed = await request(app).delete(`/share/people/${invited.body.person.id}`).set(auth);
    expect(removed.status).toBe(204);

    const listAfter = await request(app).get("/share").set(auth);
    expect(listAfter.body.sharedWith).toHaveLength(0);
  });

  it("exposes only synced tasks on the public token endpoint", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const shareRes = await request(app).get("/share").set(auth);
    const token = shareRes.body.shareToken;

    await request(app).post("/tasks").set(auth).send({ title: "Privée", category: "Maison", weekday: 0, time: "08:00", synced: false });
    await request(app).post("/tasks").set(auth).send({ title: "Synchronisée", category: "Maison", weekday: 0, time: "09:00", synced: true });

    const publicView = await request(app).get(`/share/public/${token}`);
    expect(publicView.status).toBe(200);
    expect(publicView.body.tasks).toHaveLength(1);
    expect(publicView.body.tasks[0].title).toBe("Synchronisée");
  });

  it("404s on an invalid share token", async () => {
    const res = await request(app).get("/share/public/not-a-real-token");
    expect(res.status).toBe(404);
  });
});

describe("member share links", () => {
  it("shows one member's week as a web page, and a reset link revokes the old one", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const jules = (await request(app).post("/members").set(auth).send({ name: "Jules", initials: "J" })).body.member;
    const lea = (await request(app).post("/members").set(auth).send({ name: "Léa", initials: "L" })).body.member;
    await request(app).post("/tasks").set(auth).send({ title: "Piscine <b>", category: "Loisirs", weekday: 2, time: "17:00", memberIds: [jules.id] });
    await request(app).post("/tasks").set(auth).send({ title: "Danse", category: "Loisirs", weekday: 2, time: "18:00", memberIds: [lea.id] });
    await request(app).post("/tasks").set(auth).send({ title: "Dentiste", category: "Santé", weekday: 0, time: "14:30", appointmentDate: "2026-12-03", location: "Cabinet", memberIds: [jules.id] });

    const links = (await request(app).get("/share/members").set(auth)).body.links;
    const link = links.find((l: { memberId: string }) => l.memberId === jules.id);
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    // Le même jeton tant qu'on ne le renouvelle pas.
    expect((await request(app).get("/share/members").set(auth)).body.links.find((l: { memberId: string }) => l.memberId === jules.id).token).toBe(link.token);

    const page = await request(app).get(`/share/m/${link.token}?week=2026-11-30`);
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toMatch(/html/);
    expect(page.text).toContain("Planning de Jules");
    expect(page.text).toContain("Piscine &lt;b&gt;");
    expect(page.text).toContain("Dentiste");
    expect(page.text).toContain("Cabinet");
    expect(page.text).not.toContain("Danse");

    // Le rendez-vous n'apparaît pas une autre semaine.
    const other = await request(app).get(`/share/m/${link.token}?week=2026-12-07`);
    expect(other.text).not.toContain("Dentiste");
    expect(other.text).toContain("Piscine");

    const reset = await request(app).post(`/share/members/${jules.id}/reset`).set(auth);
    expect(reset.body.token).not.toBe(link.token);
    expect((await request(app).get(`/share/m/${link.token}`)).status).toBe(404);
    expect((await request(app).get(`/share/m/${reset.body.token}`)).status).toBe(200);
  });

  it("does not reset another family's member", async () => {
    const a = await signup(app);
    const b = await signup(app);
    const m = (await request(app).post("/members").set(authHeader(a.accessToken)).send({ name: "Jules", initials: "J" })).body.member;
    expect((await request(app).post(`/share/members/${m.id}/reset`).set(authHeader(b.accessToken))).status).toBe(404);
  });
});
