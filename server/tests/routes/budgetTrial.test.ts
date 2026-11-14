import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { BUDGET_TRIAL_DAYS } from "../../src/lib/plan";
import { authHeader, signup } from "../helpers";

const DAY = 86_400_000;

async function account() {
  const { accessToken, user } = await signup(app);
  return { auth: authHeader(accessToken), userId: user.id };
}
const plan = (auth: Record<string, string>) => request(app).get("/plan").set(auth);
const start = (auth: Record<string, string>) => request(app).post("/plan/trial/budget").set(auth);
// Creating a savings goal is a Budget+ feature (listing them is not).
const savings = (auth: Record<string, string>) => request(app).post("/savings-goals").set(auth).send({ name: "Vacances", targetCents: 50_000, deadline: null });

describe("Budget+ free trial", () => {
  it("is offered to an account that never had it, without opening anything yet", async () => {
    const { auth } = await account();
    const res = await plan(auth);
    expect(res.body.packs.budget).toMatchObject({ active: false, until: null, trial: { available: true, active: false, days: BUDGET_TRIAL_DAYS, endsAt: null } });
    expect((await savings(auth)).status).toBe(403);
  });

  it("starts on request, opens Budget+ for 4 weeks, and only Budget+", async () => {
    const { auth } = await account();
    const res = await start(auth);
    expect(res.status).toBe(201);

    const { budget, meals } = res.body.packs;
    expect(budget).toMatchObject({ active: true, trial: { available: false, active: true } });
    const days = (Date.parse(budget.trial.endsAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(BUDGET_TRIAL_DAYS - 0.01);
    expect(days).toBeLessThanOrEqual(BUDGET_TRIAL_DAYS);
    expect(budget.until).toBe(budget.trial.endsAt);
    expect(meals.active).toBe(false);

    // Budget+ features answer; unlimited documents come with it.
    expect((await savings(auth)).status).toBe(201);
    expect(res.body.documents.limit).toBeNull();
  });

  it("can only be started once", async () => {
    const { auth } = await account();
    await start(auth);
    const again = await start(auth);
    expect(again.status).toBe(409);
    expect(again.body.error).toContain("déjà été utilisé");
  });

  it("two taps at once start it a single time", async () => {
    const { auth, userId } = await account();
    const results = await Promise.all([start(auth), start(auth)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ budgetTrialStartedAt: expect.any(Date) });
  });

  it("ends after 4 weeks: features lock again and it isn't offered a second time", async () => {
    const { auth, userId } = await account();
    await prisma.user.update({ where: { id: userId }, data: { budgetTrialStartedAt: new Date(Date.now() - (BUDGET_TRIAL_DAYS + 1) * DAY) } });
    const res = await plan(auth);
    expect(res.body.packs.budget).toMatchObject({ active: false, until: null, trial: { available: false, active: false } });
    expect((await savings(auth)).status).toBe(403);
    expect((await start(auth)).status).toBe(409);
  });

  it("is pointless with a paid pack, which stays in charge of the dates", async () => {
    const { auth, userId } = await account();
    await prisma.user.update({ where: { id: userId }, data: { budgetUntil: new Date(Date.now() + 90 * DAY) } });
    const res = await plan(auth);
    expect(res.body.packs.budget.trial).toMatchObject({ available: false, active: false });
    expect((await start(auth)).status).toBe(409);
  });

  it("a subscription bought during the trial takes over", async () => {
    const { auth, userId } = await account();
    await start(auth);
    const paid = new Date(Date.now() + 365 * DAY);
    await prisma.user.update({ where: { id: userId }, data: { budgetUntil: paid } });
    const { budget } = (await plan(auth)).body.packs;
    expect(budget).toMatchObject({ active: true, until: paid.toISOString(), trial: { active: false } });
  });

  it("keeps each account's trial apart", async () => {
    const a = await account();
    const b = await account();
    await start(a.auth);
    expect((await plan(b.auth)).body.packs.budget.trial.available).toBe(true);
    expect((await savings(b.auth)).status).toBe(403);
  });
});
