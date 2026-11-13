import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as planner from "../../src/services/mealPlanner";
import { currentMonth } from "../../src/routes/expenses";
import { authHeader, signup } from "../helpers";

const DAY = 86_400_000;
const prefs = { diets: [] };
const week = (auth: Record<string, string>) =>
  request(app).post("/meals/generate").set(auth).send({ slots: [{ weekday: 0, type: "dîner" }], preferences: prefs, kind: "week" });
const reroll = (auth: Record<string, string>) =>
  request(app).post("/meals/generate").set(auth).send({ slots: [{ weekday: 0, type: "dîner" }], preferences: prefs, kind: "reroll" });

async function account() {
  const { accessToken, user } = await signup(app);
  return { auth: authHeader(accessToken), userId: user.id };
}
const soon = () => new Date(Date.now() + 30 * DAY);
const makePremium = (userId: string) => prisma.user.update({ where: { id: userId }, data: { budgetUntil: soon(), mealsUntil: soon() } });
const giveBudget = (userId: string) => prisma.user.update({ where: { id: userId }, data: { budgetUntil: soon() } });
const giveMeals = (userId: string) => prisma.user.update({ where: { id: userId }, data: { mealsUntil: soon() } });

afterEach(() => {
  vi.restoreAllMocks();
  env.anthropicApiKey = "";
});

describe("menu generation quotas", () => {
  function mockPlanner() {
    env.anthropicApiKey = "test-key";
    vi.spyOn(planner, "proposeMeals").mockResolvedValue([{ weekday: 0, type: "dîner", title: "Soupe", recipeId: null, notes: "" }]);
  }

  it("gives 4 weeks during the trial, with 15 « autre idée » per week generated", async () => {
    mockPlanner();
    const { auth } = await account();

    expect((await reroll(auth)).status).toBe(403); // nothing generated yet
    for (let i = 0; i < 4; i++) expect((await week(auth)).status).toBe(200);
    const fifth = await week(auth);
    expect(fifth.status).toBe(403);
    expect(fifth.body.code).toBe("quota_exceeded");

    const plan = await request(app).get("/plan").set(auth);
    expect(plan.body.meals).toMatchObject({ period: "trial", weeksUsed: 4, weeksLimit: 4, rerollsUsed: 0, rerollsLimit: 60 });
  });

  it("gives 1 week a month after the trial, and doesn't count trial generations against it", async () => {
    mockPlanner();
    const { auth, userId } = await account();
    await prisma.user.update({ where: { id: userId }, data: { createdAt: new Date(Date.now() - 45 * DAY) } });
    await prisma.mealGeneration.create({ data: { userId, kind: "week", createdAt: new Date(Date.now() - 40 * DAY) } });

    expect((await week(auth)).status).toBe(200);
    expect((await week(auth)).status).toBe(403);
    for (let i = 0; i < 15; i++) expect((await reroll(auth)).status).toBe(200);
    expect((await reroll(auth)).status).toBe(403);
  });

  it("only counts generations that succeeded", async () => {
    env.anthropicApiKey = "test-key";
    vi.spyOn(planner, "proposeMeals").mockRejectedValue(new planner.MealPlannerError("oups"));
    const { auth } = await account();
    expect((await week(auth)).status).toBe(502);
    expect((await request(app).get("/meals/quota").set(auth)).body.quota.weeksUsed).toBe(0);
  });

  it("gives the Menus pack 12 weeks and 60 « autre idée » a month", async () => {
    mockPlanner();
    const { auth, userId } = await account();
    await giveMeals(userId);
    await prisma.mealGeneration.createMany({ data: Array.from({ length: 11 }, () => ({ userId, kind: "week" })) });
    expect((await week(auth)).status).toBe(200);
    expect((await week(auth)).status).toBe(403);
    const plan = await request(app).get("/plan").set(auth);
    expect(plan.body).toMatchObject({
      packs: { budget: { active: false }, meals: { active: true } },
      meals: { period: "premium", weeksLimit: 12, rerollsLimit: 60 },
      documents: { limit: null },
    });
  });

  it("refuses a reroll that covers several meals", async () => {
    mockPlanner();
    const { auth } = await account();
    const res = await request(app)
      .post("/meals/generate")
      .set(auth)
      .send({ slots: [{ weekday: 0, type: "dîner" }, { weekday: 1, type: "dîner" }], preferences: prefs, kind: "reroll" });
    expect(res.status).toBe(400);
  });
});

describe("budget cap alerts (Premium)", () => {
  const month = currentMonth();
  const add = (auth: Record<string, string>, amountCents: number) =>
    request(app).post("/expenses").set(auth).send({ label: "Courses", amountCents, category: "courses", date: `${month}-01` });

  it("alerts once at 80 % and once at 100 %, with an in-app notification", async () => {
    const { auth, userId } = await account();
    await makePremium(userId);
    await request(app).put("/category-budgets").set(auth).send({ category: "courses", limitCents: 10000 });

    expect((await add(auth, 5000)).body.alert).toBeNull();
    expect((await add(auth, 3000)).body.alert).toMatchObject({ level: 80, categoryName: "Courses", totalCents: 8000 });
    expect((await add(auth, 500)).body.alert).toBeNull(); // 85 %: already told
    expect((await add(auth, 2000)).body.alert).toMatchObject({ level: 100, totalCents: 10500 });
    expect((await add(auth, 100)).body.alert).toBeNull();

    const notifications = await request(app).get("/notifications").set(auth);
    expect(notifications.body.notifications.map((n: { title: string }) => n.title)).toEqual([
      "Plafond « Courses » atteint : 105 € sur 100 €",
      "« Courses » à 80 % du plafond : 80 € sur 100 €",
    ]);
  });

  it("jumping straight past 100 % raises only the 100 % alert", async () => {
    const { auth, userId } = await account();
    await makePremium(userId);
    await request(app).put("/category-budgets").set(auth).send({ category: "courses", limitCents: 10000 });
    expect((await add(auth, 12000)).body.alert).toMatchObject({ level: 100 });
    expect((await add(auth, 100)).body.alert).toBeNull();
  });

  it("needs the Budget pack, not the Menus one", async () => {
    const { auth, userId } = await account();
    await giveMeals(userId);
    await request(app).put("/category-budgets").set(auth).send({ category: "courses", limitCents: 10000 });
    expect((await add(auth, 12000)).body.alert).toBeNull();
    const refused = await request(app).post("/savings-goals").set(auth).send({ name: "x", targetCents: 100 });
    expect(refused.status).toBe(403);
    expect(refused.body.pack).toBe("budget");
  });

  it("does nothing for a free account", async () => {
    const { auth } = await account();
    await request(app).put("/category-budgets").set(auth).send({ category: "courses", limitCents: 10000 });
    expect((await add(auth, 12000)).body.alert).toBeNull();
  });
});

describe("savings goals (Premium)", () => {
  it("creates a goal, adds payments that show in the month's budget, and tracks progress", async () => {
    const { auth, userId } = await account();
    expect((await request(app).post("/savings-goals").set(auth).send({ name: "Vacances", targetCents: 120000 })).status).toBe(403);
    await makePremium(userId);

    const created = await request(app).post("/savings-goals").set(auth).send({ name: "Vacances", targetCents: 120000, deadline: "2027-07-01" });
    expect(created.status).toBe(201);
    const id = created.body.goal.id;

    const paid = await request(app).post(`/savings-goals/${id}/payments`).set(auth).send({ amountCents: 15000 });
    expect(paid.body.goal).toMatchObject({ savedCents: 15000, targetCents: 120000, deadline: "2027-07-01" });

    const budget = await request(app).get(`/expenses?month=${currentMonth()}`).set(auth);
    expect(budget.body.expenses[0]).toMatchObject({ label: "Épargne · Vacances", category: "épargne", goalId: id });

    // Deleting the goal keeps the money in the budget.
    expect((await request(app).delete(`/savings-goals/${id}`).set(auth)).status).toBe(204);
    const after = await request(app).get(`/expenses?month=${currentMonth()}`).set(auth);
    expect(after.body.expenses[0]).toMatchObject({ category: "épargne", goalId: null });
  });
});

describe("monthly report (Premium)", () => {
  it("returns the last months oldest first, with totals per category", async () => {
    const { auth, userId } = await account();
    expect((await request(app).get("/expenses/report").set(auth)).status).toBe(403);
    await makePremium(userId);
    const month = currentMonth();
    await request(app).post("/expenses").set(auth).send({ label: "a", amountCents: 1000, category: "courses", date: `${month}-01` });
    await request(app).post("/expenses").set(auth).send({ label: "b", amountCents: 500, category: "loisirs", date: `${month}-02` });

    const res = await request(app).get("/expenses/report?months=3").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(3);
    expect(res.body.months[2]).toEqual({
      month,
      totalCents: 1500,
      byCategory: [
        { category: "courses", totalCents: 1000 },
        { category: "loisirs", totalCents: 500 },
      ],
    });
    expect(res.body.months[0].totalCents).toBe(0);
  });
});

describe("end-of-month forecast (Budget pack)", () => {
  it("is reserved to the Budget pack and returns the projection for the current month", async () => {
    const { auth, userId } = await account();
    expect((await request(app).get("/expenses/forecast").set(auth)).status).toBe(403);
    await giveBudget(userId);
    await request(app).post("/expenses").set(auth).send({ label: "a", amountCents: 1000, category: "courses", date: `${currentMonth()}-01` });
    const res = await request(app).get("/expenses/forecast").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ month: currentMonth(), spentCents: 1000, usualCents: null });
    expect(res.body.projectedCents).toBeGreaterThanOrEqual(1000);
  });
});

describe("expense export (Budget pack)", () => {
  it("exports a CSV for French spreadsheets, and a PDF", async () => {
    const { auth, userId } = await account();
    const month = currentMonth();
    expect((await request(app).get(`/expenses/export?from=${month}&to=${month}&format=csv`).set(auth)).status).toBe(403);
    await giveBudget(userId);
    const member = await request(app).post("/members").set(auth).send({ name: "Jules", tint: "neutral" });
    await request(app).post("/expenses").set(auth).send({ label: "Cantine; mars", amountCents: 123456, category: "enfants", memberId: member.body.member?.id ?? null, date: `${month}-02` });
    await request(app).post("/expenses").set(auth).send({ label: "=SOMME(A1)", amountCents: 500, category: "divers", date: `${month}-01` });

    const csv = await request(app).get(`/expenses/export?from=${month}&to=${month}&format=csv`).set(auth);
    expect(csv.status).toBe(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toBe(`attachment; filename="depenses-${month}.csv"`);
    const lines = csv.text.replace("﻿", "").trim().split("\r\n");
    expect(lines[0]).toBe("Date;Libellé;Catégorie;Pour qui;Montant (€);Récurrente");
    expect(lines[1]).toBe(`01/${month.slice(5)}/${month.slice(0, 4)};'=SOMME(A1);Divers;;5,00;non`);
    expect(lines[2]).toContain(`"Cantine; mars";Enfants;`);
    expect(lines[2]).toContain(";1234,56;non");

    const pdf = await request(app).get(`/expenses/export?from=${month}&to=${month}&format=pdf`).set(auth).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses an inverted or too long period", async () => {
    const { auth, userId } = await account();
    await giveBudget(userId);
    expect((await request(app).get("/expenses/export?from=2026-05&to=2026-01&format=csv").set(auth)).status).toBe(400);
    expect((await request(app).get("/expenses/export?from=2024-01&to=2026-01&format=csv").set(auth)).status).toBe(400);
  });
});
