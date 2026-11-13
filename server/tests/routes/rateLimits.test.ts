import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { signup } from "../helpers";

describe("auth rate limits", () => {
  beforeAll(() => {
    process.env.DISABLE_RATE_LIMIT = "0";
  });
  afterAll(() => {
    process.env.DISABLE_RATE_LIMIT = "1";
  });

  it("blocks an email after 10 login attempts, without locking other emails", async () => {
    process.env.DISABLE_RATE_LIMIT = "1";
    await signup(app, { email: "limite@passerelle.test" });
    process.env.DISABLE_RATE_LIMIT = "0";

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/auth/login").send({ email: "limite@passerelle.test", password: "mauvais-mdp" });
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post("/auth/login").send({ email: "limite@passerelle.test", password: "password123" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Trop de tentatives/);

    const other = await request(app).post("/auth/login").send({ email: "autre@passerelle.test", password: "x" });
    expect(other.status).not.toBe(429);
  });
});
