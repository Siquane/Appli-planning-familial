import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";
import * as storage from "../../src/lib/storage";

describe("DELETE /auth/me", () => {
  it("refuses a wrong password and keeps the account", async () => {
    const { accessToken, user } = await signup(app);
    const res = await request(app).delete("/auth/me").set(authHeader(accessToken)).send({ password: "mauvais" });
    expect(res.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("deletes the account and everything that belongs to it", async () => {
    const { accessToken, user } = await signup(app, { password: "password123" });
    const auth = authHeader(accessToken);
    await request(app).post("/members").set(auth).send({ name: "Léo", age: 8 });
    await request(app).post("/recipes").set(auth).send({ title: "Crêpes", ingredients: [], steps: [] });

    const res = await request(app).delete("/auth/me").set(auth).send({ password: "password123" });
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.familyMember.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.recipe.count({ where: { userId: user.id } })).toBe(0);
  });

  it("also removes the stored photos of the family's Cervelle revisions and tests", async () => {
    const { accessToken, user } = await signup(app, { password: "password123" });
    const learner = await prisma.learner.create({ data: { userId: user.id, name: "Léo", level: "college" } });
    await prisma.revision.create({ data: { learnerId: learner.id, photoKeys: ["cervelle/f/r1/0.jpg", "cervelle/f/r1/1.jpg"] } });
    await prisma.examReview.create({ data: { learnerId: learner.id, photoKeys: ["cervelle/f/interro-1/0.jpg"] } });
    const remove = vi.spyOn(storage, "removeObjects").mockResolvedValue(undefined);

    const res = await request(app).delete("/auth/me").set(authHeader(accessToken)).send({ password: "password123" });
    expect(res.status).toBe(204);
    expect(remove).toHaveBeenCalledWith(expect.arrayContaining(["cervelle/f/r1/0.jpg", "cervelle/f/r1/1.jpg", "cervelle/f/interro-1/0.jpg"]));
    expect(await prisma.learner.count({ where: { userId: user.id } })).toBe(0);
    remove.mockRestore();
  });
});
