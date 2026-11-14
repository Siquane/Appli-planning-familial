import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setMailTransport, type Mail } from "../../src/services/mailer";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("POST /auth/signup", () => {
  it("creates a user and returns tokens", async () => {
    const res = await request(app).post("/auth/signup").send({ email: "claire@passerelle.test", password: "password123", name: "Claire Dubois", age15: true });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: "claire@passerelle.test", name: "Claire Dubois", initials: "CD" });
    expect(typeof res.body.accessToken).toBe("string");
    expect(typeof res.body.refreshToken).toBe("string");
  });

  it("rejects a duplicate email", async () => {
    await signup(app, { email: "dup@passerelle.test" });
    const res = await request(app).post("/auth/signup").send({ email: "dup@passerelle.test", password: "password123", name: "Someone Else", age15: true });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid payload", async () => {
    const res = await request(app).post("/auth/signup").send({ email: "not-an-email", password: "short", name: "" });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with the correct password", async () => {
    await signup(app, { email: "login@passerelle.test", password: "password123" });
    const res = await request(app).post("/auth/login").send({ email: "login@passerelle.test", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("login@passerelle.test");
  });

  it("rejects a wrong password", async () => {
    await signup(app, { email: "login2@passerelle.test", password: "password123" });
    const res = await request(app).post("/auth/login").send({ email: "login2@passerelle.test", password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app).post("/auth/login").send({ email: "nobody@passerelle.test", password: "password123" });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("rotates the refresh token and invalidates the old one", async () => {
    const { refreshToken } = await signup(app, { email: "refresh@passerelle.test" });

    const first = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.refreshToken).not.toBe(refreshToken);

    // The old refresh token was consumed — reusing it fails.
    const reuse = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(reuse.status).toBe(401);

    // The newly issued one still works.
    const second = await request(app).post("/auth/refresh").send({ refreshToken: first.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it("rejects a bogus refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({ refreshToken: "not-a-real-token" });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("invalidates the refresh token", async () => {
    const { refreshToken } = await signup(app, { email: "logout@passerelle.test" });
    const logoutRes = await request(app).post("/auth/logout").send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("requires a bearer token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid token", async () => {
    const { accessToken, user } = await signup(app, { email: "me@passerelle.test" });
    const res = await request(app).get("/auth/me").set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});

describe("PATCH /auth/me", () => {
  it("renames the user and recomputes the initials", async () => {
    const { accessToken } = await signup(app, { email: "rename@passerelle.test" });
    const res = await request(app).patch("/auth/me").set(authHeader(accessToken)).send({ name: "  Anaïs Martin " });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "Anaïs Martin", initials: "AM" });
    const me = await request(app).get("/auth/me").set(authHeader(accessToken));
    expect(me.body.user.name).toBe("Anaïs Martin");
  });

  it("refuses an empty name and needs to be signed in", async () => {
    const { accessToken } = await signup(app, { email: "blank@passerelle.test" });
    expect((await request(app).patch("/auth/me").set(authHeader(accessToken)).send({ name: "   " })).status).toBe(400);
    expect((await request(app).patch("/auth/me").send({ name: "X" })).status).toBe(401);
  });
});

describe("password reset", () => {
  const sent: Mail[] = [];
  beforeEach(() => {
    sent.length = 0;
    setMailTransport(async (mail) => {
      sent.push(mail);
    });
  });
  afterEach(() => setMailTransport(null));

  const codeFrom = (mail: Mail) => mail.text.match(/\b(\d{6})\b/)![1];

  it("sends a 6-digit code and lets the user set a new password with it", async () => {
    await signup(app, { email: "Reset@Passerelle.test", password: "old-password" });

    const forgot = await request(app).post("/auth/forgot-password").send({ email: "reset@passerelle.test" });
    expect(forgot.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to.email).toBe("Reset@Passerelle.test");

    const reset = await request(app)
      .post("/auth/reset-password")
      .send({ email: "reset@passerelle.test", code: codeFrom(sent[0]), password: "new-password" });
    expect(reset.status).toBe(200);
    expect(typeof reset.body.accessToken).toBe("string");

    const oldLogin = await request(app).post("/auth/login").send({ email: "Reset@Passerelle.test", password: "old-password" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/auth/login").send({ email: "Reset@Passerelle.test", password: "new-password" });
    expect(newLogin.status).toBe(200);

    // The code is single-use.
    const reuse = await request(app)
      .post("/auth/reset-password")
      .send({ email: "reset@passerelle.test", code: codeFrom(sent[0]), password: "another-password" });
    expect(reuse.status).toBe(400);
  });

  it("answers the same way for an unknown email and sends nothing", async () => {
    const res = await request(app).post("/auth/forgot-password").send({ email: "nobody@passerelle.test" });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("signs out other devices after a reset", async () => {
    const { refreshToken } = await signup(app, { email: "devices@passerelle.test" });
    await request(app).post("/auth/forgot-password").send({ email: "devices@passerelle.test" });
    await request(app).post("/auth/reset-password").send({ email: "devices@passerelle.test", code: codeFrom(sent[0]), password: "new-password" });

    const refresh = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("locks the code after too many wrong attempts", async () => {
    await signup(app, { email: "brute@passerelle.test" });
    await request(app).post("/auth/forgot-password").send({ email: "brute@passerelle.test" });
    const good = codeFrom(sent[0]);
    const wrong = good === "000000" ? "111111" : "000000";

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/auth/reset-password").send({ email: "brute@passerelle.test", code: wrong, password: "new-password" });
      expect(res.status).toBe(400);
    }
    const res = await request(app).post("/auth/reset-password").send({ email: "brute@passerelle.test", code: good, password: "new-password" });
    expect(res.status).toBe(400);
  });

  it("does not send a second code within the cooldown", async () => {
    await signup(app, { email: "cooldown@passerelle.test" });
    await request(app).post("/auth/forgot-password").send({ email: "cooldown@passerelle.test" });
    await request(app).post("/auth/forgot-password").send({ email: "cooldown@passerelle.test" });
    expect(sent).toHaveLength(1);
  });
});
