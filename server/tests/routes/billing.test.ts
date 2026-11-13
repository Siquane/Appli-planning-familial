import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

const realFetch = global.fetch;
const future = "2027-01-15T10:00:00Z";

function mockRevenueCat(entitlements: Record<string, { expires_date: string | null }>, status = 200) {
  const fn = vi.fn(async (url: string | URL | Request) => {
    expect(String(url)).toMatch(/^https:\/\/api\.revenuecat\.com\/v1\/subscribers\//);
    return new Response(JSON.stringify({ subscriber: { entitlements } }), { status });
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  env.revenuecat.secretKey = "sk_test";
  env.revenuecat.webhookAuth = "Bearer hook-secret";
});
afterEach(() => {
  global.fetch = realFetch;
  env.revenuecat.secretKey = "";
  env.revenuecat.webhookAuth = "";
});

describe("POST /billing/sync", () => {
  it("copies RevenueCat's entitlements onto the account", async () => {
    const { accessToken, user } = await signup(app);
    const fetchMock = mockRevenueCat({ budget: { expires_date: future } });
    const res = await request(app).post("/billing/sync").set(authHeader(accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ budgetUntil: new Date(future).toISOString(), mealsUntil: null });
    expect(String(fetchMock.mock.calls[0][0])).toContain(user.id);

    const plan = await request(app).get("/plan").set(authHeader(accessToken));
    expect(plan.body.packs).toMatchObject({ budget: { active: true }, meals: { active: false } });
  });

  it("treats an entitlement without expiry as lifetime, and clears what RevenueCat no longer grants", async () => {
    const { accessToken, user } = await signup(app);
    await prisma.user.update({ where: { id: user.id }, data: { mealsUntil: new Date(future) } });
    mockRevenueCat({ budget: { expires_date: null } });
    const res = await request(app).post("/billing/sync").set(authHeader(accessToken));
    expect(res.body.budgetUntil).toBe("2999-12-31T23:59:59.000Z");
    expect(res.body.mealsUntil).toBeNull();
  });

  it("answers 502 when RevenueCat fails and 503 when billing isn't configured", async () => {
    const { accessToken } = await signup(app);
    mockRevenueCat({}, 500);
    expect((await request(app).post("/billing/sync").set(authHeader(accessToken))).status).toBe(502);
    env.revenuecat.secretKey = "";
    expect((await request(app).post("/billing/sync").set(authHeader(accessToken))).status).toBe(503);
  });
});

describe("POST /billing/revenuecat (webhook)", () => {
  it("rejects a call without the shared secret", async () => {
    expect((await request(app).post("/billing/revenuecat").send({ event: {} })).status).toBe(401);
    expect((await request(app).post("/billing/revenuecat").set("Authorization", "Bearer wrong").send({ event: {} })).status).toBe(401);
  });

  it("re-syncs the users named in the event and ignores unknown ids", async () => {
    const { user } = await signup(app);
    mockRevenueCat({ meals: { expires_date: future } });
    const res = await request(app)
      .post("/billing/revenuecat")
      .set("Authorization", "Bearer hook-secret")
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: user.id, transferred_from: ["$RCAnonymousID:abc"] } });
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(1);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.mealsUntil?.toISOString()).toBe(new Date(future).toISOString());
  });
});
