import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

async function family() {
  const owner = await signup(app, { name: "Anaïs" });
  const ownerAuth = authHeader(owner.accessToken);
  const code = (await request(app).post("/family/invite").set(ownerAuth).send({ role: "planning" })).body.invite.code;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `lea${Date.now()}${Math.random()}@passerelle.test`, password: "password123", name: "Léa", familyCode: code, age15: true });
  return { ownerAuth, joinerAuth: authHeader(res.body.accessToken as string) };
}

describe("/notes", () => {
  it("shows family notes to every account and personal notes to their author only", async () => {
    const { ownerAuth, joinerAuth } = await family();
    const shared = await request(app).post("/notes").set(ownerAuth).send({ title: "Code du portail", body: "4521" });
    expect(shared.status).toBe(201);
    expect(shared.body.note).toMatchObject({ shared: true, mine: true, authorName: "Anaïs", color: "default", pinned: false });
    await request(app).post("/notes").set(ownerAuth).send({ body: "Idée cadeau pour Léa", shared: false });
    await request(app).post("/notes").set(joinerAuth).send({ body: "Rappeler le dentiste", shared: false });

    const mine = (await request(app).get("/notes").set(ownerAuth)).body.notes;
    expect(mine.map((n: { body: string }) => n.body).sort()).toEqual(["4521", "Idée cadeau pour Léa"]);
    const hers = (await request(app).get("/notes").set(joinerAuth)).body.notes;
    expect(hers.map((n: { body: string }) => n.body).sort()).toEqual(["4521", "Rappeler le dentiste"]);
    expect(hers.find((n: { body: string }) => n.body === "4521")).toMatchObject({ mine: false, authorName: "Anaïs" });
  });

  it("lists pinned notes first, edits and deletes", async () => {
    const { ownerAuth, joinerAuth } = await family();
    const a = (await request(app).post("/notes").set(ownerAuth).send({ body: "A" })).body.note;
    await request(app).post("/notes").set(ownerAuth).send({ body: "B" });
    const pinned = await request(app).patch(`/notes/${a.id}`).set(joinerAuth).send({ pinned: true, color: "violet" });
    expect(pinned.body.note).toMatchObject({ pinned: true, color: "violet", body: "A" });
    expect((await request(app).get("/notes").set(ownerAuth)).body.notes[0].body).toBe("A");

    // Only its author can make a family note personal.
    expect((await request(app).patch(`/notes/${a.id}`).set(joinerAuth).send({ shared: false })).status).toBe(403);
    await request(app).patch(`/notes/${a.id}`).set(ownerAuth).send({ shared: false });
    expect((await request(app).get("/notes").set(joinerAuth)).body.notes.map((n: { body: string }) => n.body)).toEqual(["B"]);

    expect((await request(app).delete(`/notes/${a.id}`).set(joinerAuth)).status).toBe(404);
    expect((await request(app).delete(`/notes/${a.id}`).set(ownerAuth)).status).toBe(204);
  });

  it("refuses an empty note or an unknown colour, and hides other families' notes", async () => {
    const { ownerAuth } = await family();
    expect((await request(app).post("/notes").set(ownerAuth).send({ title: " ", body: "  " })).status).toBe(400);
    expect((await request(app).post("/notes").set(ownerAuth).send({ body: "x", color: "pink" })).status).toBe(400);
    const note = (await request(app).post("/notes").set(ownerAuth).send({ body: "x" })).body.note;
    const other = authHeader((await signup(app)).accessToken);
    expect((await request(app).get("/notes").set(other)).body.notes).toEqual([]);
    expect((await request(app).patch(`/notes/${note.id}`).set(other).send({ body: "y" })).status).toBe(404);
  });
});
