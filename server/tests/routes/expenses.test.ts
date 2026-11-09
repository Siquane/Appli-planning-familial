import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("expenses", () => {
  it("creates, lists, edits and deletes an expense", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/expenses").set(auth).send({ label: "Supermarché", amountCents: 8450, category: "courses", date: "2026-11-03" });
    expect(created.status).toBe(201);
    expect(created.body.expense).toMatchObject({ label: "Supermarché", amountCents: 8450, category: "courses", date: "2026-11-03" });
    const id = created.body.expense.id;

    const patched = await request(app).patch(`/expenses/${id}`).set(auth).send({ amountCents: 9000, date: "2026-11-04" });
    expect(patched.status).toBe(200);
    expect(patched.body.expense).toMatchObject({ amountCents: 9000, date: "2026-11-04", label: "Supermarché" });

    await request(app).delete(`/expenses/${id}`).set(auth).expect(204);
    const list = await request(app).get("/expenses?month=2026-11").set(auth);
    expect(list.body.expenses).toHaveLength(0);
    expect(list.body.totalCents).toBe(0);
  });

  it("totals a month overall and per category, ignoring other months", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const add = (body: object) => request(app).post("/expenses").set(auth).send(body).expect(201);

    await add({ label: "Courses", amountCents: 5000, category: "courses", date: "2026-11-01" });
    await add({ label: "Marché", amountCents: 2550, category: "courses", date: "2026-11-30" });
    await add({ label: "Loyer", amountCents: 90000, category: "logement", date: "2026-11-05" });
    await add({ label: "Octobre", amountCents: 1000, category: "courses", date: "2026-10-31" });
    await add({ label: "Décembre", amountCents: 1000, category: "courses", date: "2026-12-01" });

    const res = await request(app).get("/expenses?month=2026-11").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe("2026-11");
    expect(res.body.expenses).toHaveLength(3);
    expect(res.body.totalCents).toBe(97550);
    expect(res.body.byCategory).toEqual([
      { category: "logement", totalCents: 90000 },
      { category: "courses", totalCents: 7550 },
    ]);
    // Most recent first.
    expect(res.body.expenses.map((e: { date: string }) => e.date)).toEqual(["2026-11-30", "2026-11-05", "2026-11-01"]);
  });

  it("rejects invalid amounts, categories, dates and months", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const base = { label: "Test", amountCents: 100, category: "courses", date: "2026-11-01" };

    expect((await request(app).post("/expenses").set(auth).send({ ...base, amountCents: 0 })).status).toBe(400);
    expect((await request(app).post("/expenses").set(auth).send({ ...base, amountCents: 12.5 })).status).toBe(400);
    expect((await request(app).post("/expenses").set(auth).send({ ...base, category: "vacances" })).status).toBe(400);
    expect((await request(app).post("/expenses").set(auth).send({ ...base, date: "2026-02-30" })).status).toBe(400);
    expect((await request(app).post("/expenses").set(auth).send({ ...base, label: "  " })).status).toBe(400);
    expect((await request(app).get("/expenses?month=2026-13").set(auth)).status).toBe(400);
  });

  it("isolates expenses between families", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });
    const created = await request(app)
      .post("/expenses")
      .set(authHeader(userA.accessToken))
      .send({ label: "Loyer", amountCents: 90000, category: "logement", date: "2026-11-05" });

    const listB = await request(app).get("/expenses?month=2026-11").set(authHeader(userB.accessToken));
    expect(listB.body.expenses).toHaveLength(0);
    expect((await request(app).patch(`/expenses/${created.body.expense.id}`).set(authHeader(userB.accessToken)).send({ amountCents: 1 })).status).toBe(404);
    expect((await request(app).delete(`/expenses/${created.body.expense.id}`).set(authHeader(userB.accessToken))).status).toBe(404);
  });
});
