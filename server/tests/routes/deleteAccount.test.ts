import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

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
});
