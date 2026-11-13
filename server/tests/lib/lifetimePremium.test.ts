import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { grantLifetimePremium, isLifetimeEmail, lifetimeEmails, LIFETIME_UNTIL } from "../../src/lib/lifetimePremium";
import { syncUserPacks } from "../../src/lib/revenuecat";
import { authHeader, signup } from "../helpers";

afterEach(() => {
  env.lifetimePremiumEmails = "";
});

describe("Premium à vie", () => {
  it("parses the list, ignoring case and spaces", () => {
    expect(lifetimeEmails(" A@x.fr , ,b@Y.fr")).toEqual(["a@x.fr", "b@y.fr"]);
    expect(isLifetimeEmail("B@y.FR", ["a@x.fr", "b@y.fr"])).toBe(true);
    expect(isLifetimeEmail("c@z.fr", ["a@x.fr"])).toBe(false);
  });

  it("gives both packs forever to listed accounts only", async () => {
    const family = await signup(app, { email: "famille@passerelle.test" });
    const other = await signup(app);
    env.lifetimePremiumEmails = "FAMILLE@passerelle.test";
    expect(await grantLifetimePremium()).toBe(1);

    const plan = await request(app).get("/plan").set(authHeader(family.accessToken));
    expect(plan.body.packs).toMatchObject({ budget: { active: true }, meals: { active: true } });
    const otherPlan = await request(app).get("/plan").set(authHeader(other.accessToken));
    expect(otherPlan.body.packs).toMatchObject({ budget: { active: false }, meals: { active: false } });
  });

  it("keeps both packs when RevenueCat syncs (no store call)", async () => {
    const family = await signup(app, { email: "famille2@passerelle.test" });
    env.lifetimePremiumEmails = "famille2@passerelle.test";
    const dates = await syncUserPacks(family.user.id);
    expect(dates).toEqual({ budgetUntil: LIFETIME_UNTIL, mealsUntil: LIFETIME_UNTIL });
  });

  it("does nothing without a list", async () => {
    expect(await grantLifetimePremium()).toBe(0);
  });
});
