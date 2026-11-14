import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";
import { FAKE_DEBITS_TOTAL_CENTS, fakeStatementPdf } from "../statementPdf";

const DAY = 86_400_000;

async function budgetAccount() {
  const { accessToken, user } = await signup(app);
  await prisma.user.update({ where: { id: user.id }, data: { budgetUntil: new Date(Date.now() + 30 * DAY) } });
  return { auth: authHeader(accessToken), userId: user.id };
}

const parse = async (auth: Record<string, string>, body?: Buffer) =>
  request(app)
    .post("/statements/parse")
    .set(auth)
    .set("Content-Type", "application/pdf")
    .send(body ?? (await fakeStatementPdf()));

describe("POST /statements/parse", () => {
  it("is part of Budget+", async () => {
    const { accessToken } = await signup(app);
    const res = await parse(authHeader(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("premium_required");
  });

  it("reads the statement, suggests categories and checks the printed total, without storing anything", async () => {
    const { auth, userId } = await budgetAccount();
    const res = await parse(auth);
    expect(res.status).toBe(200);

    expect(res.body.rows).toHaveLength(6);
    expect(res.body.ignoredCredits).toEqual({ count: 2, totalCents: 5399 });
    expect(res.body.check).toEqual({ readDebitsCents: FAKE_DEBITS_TOTAL_CENTS, expectedDebitsCents: FAKE_DEBITS_TOTAL_CENTS, ok: true });

    const byLabel = Object.fromEntries(res.body.rows.map((r: { label: string }) => [r.label, r]));
    expect(byLabel["Carrefour City Lyon"]).toMatchObject({ category: "courses", date: "2026-10-03", duplicate: false, recurringHint: false });
    expect(byLabel["Canal+ France"]).toMatchObject({ category: "abonnements", recurringHint: true });
    expect(byLabel["Web Jean Martin"]).toMatchObject({ category: "logement", recurringHint: true });
    expect(byLabel["Mystere Boutique"]).toMatchObject({ category: "divers", source: "default" });

    // Nothing was saved by reading.
    expect(await prisma.expense.count({ where: { userId } })).toBe(0);
    expect(await prisma.importRule.count({ where: { userId } })).toBe(0);
  });

  it("rejects what isn't a PDF", async () => {
    const { auth } = await budgetAccount();
    const res = await parse(auth, Buffer.from("date;libelle;montant\n01/10/2026;Lidl;-12,00\n".repeat(10)));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("PDF");
  });

  it("flags a line already in the budget (same amount, within 3 days)", async () => {
    const { auth, userId } = await budgetAccount();
    await prisma.expense.create({ data: { userId, label: "Canal", amountCents: 2299, category: "abonnements", date: new Date("2026-10-07T00:00:00Z") } });
    const res = await parse(auth);
    const rows = res.body.rows as { label: string; duplicate: boolean }[];
    expect(rows.filter((r) => r.duplicate).map((r) => r.label)).toEqual(["Canal+ France"]);
  });
});

describe("POST /statements/import", () => {
  const row = (over: Record<string, unknown> = {}) => ({ date: "2026-10-05", label: "Carrefour City Lyon", amountCents: 7448, category: "courses", ...over });

  it("saves the ticked lines as expenses", async () => {
    const { auth, userId } = await budgetAccount();
    const res = await request(app).post("/statements/import").set(auth).send({ rows: [row(), row({ date: "2026-10-06", label: "Burger King", amountCents: 3510, category: "restaurants" })] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ imported: 2, recurringCreated: 0, rulesLearned: 0 });
    const saved = await prisma.expense.findMany({ where: { userId }, orderBy: { date: "asc" } });
    expect(saved.map((e) => [e.label, e.amountCents, e.category, e.date.toISOString().slice(0, 10)])).toEqual([
      ["Carrefour City Lyon", 7448, "courses", "2026-10-05"],
      ["Burger King", 3510, "restaurants", "2026-10-06"],
    ]);
  });

  it("creates a monthly expense for a recurring line, without copying that month twice", async () => {
    const { auth, userId } = await budgetAccount();
    const res = await request(app).post("/statements/import").set(auth).send({ rows: [row({ date: "2026-10-06", label: "Canal+ France", amountCents: 2299, category: "abonnements", recurring: true })] });
    expect(res.body).toMatchObject({ imported: 1, recurringCreated: 1 });

    const template = await prisma.recurringExpense.findFirstOrThrow({ where: { userId } });
    expect(template).toMatchObject({ label: "Canal+ France", amountCents: 2299, dayOfMonth: 6, startMonth: "2026-10" });

    // Reading October doesn't add a second copy.
    await request(app).get("/expenses?month=2026-10").set(auth);
    expect(await prisma.expense.count({ where: { userId, recurringId: template.id } })).toBe(1);

    // Importing the same merchant as recurring again doesn't create another template.
    await request(app).post("/statements/import").set(auth).send({ rows: [row({ date: "2026-11-06", label: "Canal+ France", amountCents: 2299, category: "abonnements", recurring: true })] });
    expect(await prisma.recurringExpense.count({ where: { userId } })).toBe(1);
  });

  it("remembers a corrected category for the next statement", async () => {
    const { auth } = await budgetAccount();
    const res = await request(app).post("/statements/import").set(auth).send({ rows: [row({ category: "loisirs", learn: true })] });
    expect(res.body.rulesLearned).toBe(1);

    const next = await parse(auth);
    // « Carrefour City Lyon » in the fake statement now goes where the family put it.
    const carrefour = next.body.rows.find((r: { label: string }) => r.label === "Carrefour City Lyon");
    expect(carrefour).toMatchObject({ category: "loisirs", source: "learned" });
  });

  it("refuses unknown categories, bad dates and empty lists", async () => {
    const { auth } = await budgetAccount();
    expect((await request(app).post("/statements/import").set(auth).send({ rows: [row({ category: "nimporte-quoi" })] })).status).toBe(400);
    expect((await request(app).post("/statements/import").set(auth).send({ rows: [row({ date: "5 octobre" })] })).status).toBe(400);
    expect((await request(app).post("/statements/import").set(auth).send({ rows: [] })).status).toBe(400);
  });

  it("is part of Budget+", async () => {
    const { accessToken } = await signup(app);
    expect((await request(app).post("/statements/import").set(authHeader(accessToken)).send({ rows: [row()] })).status).toBe(403);
  });

  it("keeps each family's rules and expenses apart", async () => {
    const a = await budgetAccount();
    const b = await budgetAccount();
    await request(app).post("/statements/import").set(a.auth).send({ rows: [row({ category: "loisirs", learn: true })] });
    const res = await parse(b.auth);
    expect(res.body.rows.find((r: { label: string }) => r.label === "Carrefour City Lyon").category).toBe("courses");
    expect(await prisma.expense.count({ where: { userId: b.userId } })).toBe(0);
  });
});
