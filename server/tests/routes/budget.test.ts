import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { currentMonth } from "../../src/routes/expenses";
import { occurrenceDate } from "../../src/lib/recurring";
import { shiftMonth } from "./monthUtil";
import { authHeader, signup } from "../helpers";

const month = currentMonth();

describe("budget: custom categories", () => {
  it("refuses a custom category that duplicates a fixed one by key or label", async () => {
    const { accessToken } = await signup(app);
    for (const name of ["Assurances", "divers", "Énergie & eau"]) {
      const res = await request(app).post("/expense-categories").set(authHeader(accessToken)).send({ name });
      expect(res.status).toBe(400);
    }
  });

  it("creates, uses, renames and deletes a category — its expenses move to 'divers'", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/expense-categories").set(auth).send({ name: "Jardin" });
    expect(created.status).toBe(201);
    const id = created.body.category.id;

    expect((await request(app).post("/expense-categories").set(auth).send({ name: "animaux" })).status).toBe(400);
    expect((await request(app).post("/expense-categories").set(auth).send({ name: "Courses" })).status).toBe(400);

    await request(app).post("/expenses").set(auth).send({ label: "Croquettes", amountCents: 3000, category: id, date: `${month}-01` }).expect(201);
    await request(app).put("/category-budgets").set(auth).send({ category: id, limitCents: 5000 }).expect(200);

    const renamed = await request(app).patch(`/expense-categories/${id}`).set(auth).send({ name: "Chat" });
    expect(renamed.body.category.name).toBe("Chat");

    await request(app).delete(`/expense-categories/${id}`).set(auth).expect(204);
    const list = await request(app).get(`/expenses?month=${month}`).set(auth);
    expect(list.body.expenses[0].category).toBe("divers");
    expect(list.body.byCategory).toEqual([{ category: "divers", totalCents: 3000, limitCents: null }]);
    expect((await request(app).get("/expense-categories").set(auth)).body.categories).toHaveLength(0);
  });

  it("rejects another family's category", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });
    const cat = await request(app).post("/expense-categories").set(authHeader(userA.accessToken)).send({ name: "Jardin" });
    const res = await request(app)
      .post("/expenses")
      .set(authHeader(userB.accessToken))
      .send({ label: "x", amountCents: 100, category: cat.body.category.id, date: `${month}-01` });
    expect(res.status).toBe(400);
    expect((await request(app).delete(`/expense-categories/${cat.body.category.id}`).set(authHeader(userB.accessToken))).status).toBe(404);
  });
});

describe("budget: caps", () => {
  it("reports each category's cap, including capped categories with nothing spent yet", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app).put("/category-budgets").set(auth).send({ category: "courses", limitCents: 60000 }).expect(200);
    await request(app).put("/category-budgets").set(auth).send({ category: "loisirs", limitCents: 10000 }).expect(200);
    await request(app).post("/expenses").set(auth).send({ label: "Supermarché", amountCents: 65000, category: "courses", date: `${month}-02` }).expect(201);

    const res = await request(app).get(`/expenses?month=${month}`).set(auth);
    expect(res.body.byCategory).toEqual([
      { category: "courses", totalCents: 65000, limitCents: 60000 },
      { category: "loisirs", totalCents: 0, limitCents: 10000 },
    ]);

    await request(app).put("/category-budgets").set(auth).send({ category: "loisirs", limitCents: null }).expect(200);
    expect((await request(app).get("/category-budgets").set(auth)).body.budgets).toEqual([{ category: "courses", limitCents: 60000 }]);
    expect((await request(app).put("/category-budgets").set(auth).send({ category: "inconnue", limitCents: 100 })).status).toBe(400);
  });
});

describe("budget: members", () => {
  it("links an expense to a family member and refuses someone else's member", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });
    const auth = authHeader(userA.accessToken);
    const lea = await request(app).post("/members").set(auth).send({ name: "Léa" });

    const created = await request(app)
      .post("/expenses")
      .set(auth)
      .send({ label: "Natation", amountCents: 12000, category: "loisirs", memberId: lea.body.member.id, date: `${month}-03` });
    expect(created.body.expense.memberId).toBe(lea.body.member.id);

    const other = await request(app)
      .post("/expenses")
      .set(authHeader(userB.accessToken))
      .send({ label: "x", amountCents: 100, category: "loisirs", memberId: lea.body.member.id, date: `${month}-03` });
    expect(other.status).toBe(400);
  });
});

describe("budget: recurring expenses", () => {
  it("adds the recurring expense once per month on its day, and deleting the copy skips only that month", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const created = await request(app).post("/recurring-expenses").set(auth).send({ label: "Loyer", amountCents: 90000, category: "logement", dayOfMonth: 5 });
    expect(created.status).toBe(201);
    expect(created.body.recurring.startMonth).toBe(month);

    const first = await request(app).get(`/expenses?month=${month}`).set(auth);
    expect(first.body.expenses).toHaveLength(1);
    expect(first.body.expenses[0]).toMatchObject({ label: "Loyer", date: `${month}-05`, recurringId: created.body.recurring.id });

    // Reading again doesn't duplicate it.
    expect((await request(app).get(`/expenses?month=${month}`).set(auth)).body.expenses).toHaveLength(1);

    // Editing this month's copy doesn't touch the template.
    await request(app).patch(`/expenses/${first.body.expenses[0].id}`).set(auth).send({ amountCents: 95000 }).expect(200);
    expect((await request(app).get("/recurring-expenses").set(auth)).body.recurring[0].amountCents).toBe(90000);

    // Deleting the copy skips this month; it doesn't come back.
    await request(app).delete(`/expenses/${first.body.expenses[0].id}`).set(auth).expect(204);
    expect((await request(app).get(`/expenses?month=${month}`).set(auth)).body.expenses).toHaveLength(0);

    // Not generated before its start month, nor in advance for future months.
    expect((await request(app).get(`/expenses?month=${shiftMonth(month, -1)}`).set(auth)).body.expenses).toHaveLength(0);
    expect((await request(app).get(`/expenses?month=${shiftMonth(month, 1)}`).set(auth)).body.expenses).toHaveLength(0);
  });

  it("keeps past copies when the recurring expense is deleted", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const created = await request(app).post("/recurring-expenses").set(auth).send({ label: "Netflix", amountCents: 1399, category: "loisirs", dayOfMonth: 12 });
    await request(app).get(`/expenses?month=${month}`).set(auth);
    await request(app).delete(`/recurring-expenses/${created.body.recurring.id}`).set(auth).expect(204);

    const list = await request(app).get(`/expenses?month=${month}`).set(auth);
    expect(list.body.expenses).toHaveLength(1);
    expect(list.body.expenses[0].recurringId).toBeNull();
  });

  it("validates the day of month", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/recurring-expenses").set(authHeader(accessToken)).send({ label: "x", amountCents: 100, category: "divers", dayOfMonth: 32 });
    expect(res.status).toBe(400);
  });

  it("clamps day 31 to the month's last day", () => {
    expect(occurrenceDate("2026-02", 31).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(occurrenceDate("2028-02", 30).toISOString().slice(0, 10)).toBe("2028-02-29");
    expect(occurrenceDate("2026-04", 31).toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(occurrenceDate("2026-05", 31).toISOString().slice(0, 10)).toBe("2026-05-31");
  });
});
