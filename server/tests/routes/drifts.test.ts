import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { currentMonth, shiftMonth } from "../../src/routes/expenses";
import { flushFamilyAlerts, setPushSender, type PushMessage } from "../../src/lib/familyAlerts";
import { authHeader, signup } from "../helpers";

let sent: PushMessage[] = [];
beforeEach(async () => {
  await flushFamilyAlerts();
  sent = [];
  setPushSender(async (m) => {
    sent.push(...m);
  });
});
afterAll(() => setPushSender(null));

async function budgetAccount(pack = true) {
  const { accessToken, user } = await signup(app, { name: "Anaïs" });
  if (pack) await prisma.user.update({ where: { id: user.id }, data: { budgetUntil: new Date(Date.now() + 90 * 86_400_000) } });
  return { auth: authHeader(accessToken), userId: user.id };
}

const month = currentMonth();
const spend = (auth: Record<string, string>, amountCents: number, m: string, category = "courses") =>
  request(app).post("/expenses").set(auth).send({ label: "Supermarché", amountCents, category, date: `${m}-01` });

describe("budget drifts", () => {
  it("reports a category well above its usual level, and alerts once per month", async () => {
    const { auth } = await budgetAccount();
    for (const n of [1, 2, 3]) await spend(auth, 400_00, shiftMonth(month, -n));
    const first = await spend(auth, 300_00, month);
    expect(first.body.drift).toBeNull();

    const second = await spend(auth, 250_00, month);
    expect(second.body.drift).toMatchObject({ category: "courses", categoryName: "Courses", totalCents: 550_00, averageCents: 400_00, increasePct: 38 });
    expect((await spend(auth, 10_00, month)).body.drift).toBeNull();

    const list = await request(app).get(`/expenses/drifts?month=${month}`).set(auth);
    expect(list.body.drifts).toHaveLength(1);
    const inbox = await request(app).get("/notifications").set(auth);
    expect(inbox.body.notifications.filter((n: { title: string }) => n.title.startsWith("Dépenses en hausse"))).toHaveLength(1);
  });

  it("pushes the alert to the other full accounts of the family, not to the one who saved", async () => {
    const { auth } = await budgetAccount();
    const code = (await request(app).post("/family/invite").set(auth).send({ role: "full" })).body.invite.code;
    const joiner = await request(app)
      .post("/auth/signup")
      .send({ email: `lea${Date.now()}@passerelle.test`, password: "password123", name: "Léa", familyCode: code, age15: true });
    const joinerAuth = authHeader(joiner.body.accessToken);
    await request(app).put("/notifications/push-token").set(auth).send({ token: "ExponentPushToken[owner]" });
    await request(app).put("/notifications/push-token").set(joinerAuth).send({ token: "ExponentPushToken[lea]" });

    for (const n of [1, 2, 3]) await spend(auth, 100_00, shiftMonth(month, -n), "loisirs");
    await spend(joinerAuth, 200_00, month, "loisirs");
    await new Promise((r) => setTimeout(r, 50));
    const budgetPushes = sent.filter((m) => m.data.url === "/budget");
    expect(budgetPushes.map((m) => m.to)).toEqual(["ExponentPushToken[owner]"]);
  });

  it("is a Budget+ feature", async () => {
    const { auth } = await budgetAccount(false);
    expect((await request(app).get("/expenses/drifts").set(auth)).status).toBe(403);
    expect((await request(app).get("/expenses/debits").set(auth)).status).toBe(403);
    for (const n of [1, 2, 3]) await spend(auth, 400_00, shiftMonth(month, -n));
    expect((await spend(auth, 900_00, month)).body.drift).toBeNull();
  });
});

describe("debit calendar", () => {
  it("lists the month's recurring expenses by day, passed and upcoming", async () => {
    const { auth } = await budgetAccount();
    await request(app).post("/recurring-expenses").set(auth).send({ label: "Loyer", amountCents: 800_00, category: "logement", dayOfMonth: 1 });
    await request(app).post("/recurring-expenses").set(auth).send({ label: "Box", amountCents: 30_00, category: "abonnements", dayOfMonth: 31 });
    const next = shiftMonth(month, 1);
    const res = await request(app).get(`/expenses/debits?month=${next}`).set(auth);
    expect(res.body.debits.map((d: { label: string }) => d.label)).toEqual(["Loyer", "Box"]);
    expect(res.body).toMatchObject({ passedCents: 0, upcomingCents: 830_00 });

    const now = await request(app).get("/expenses/debits").set(auth);
    expect(now.body.debits[0]).toMatchObject({ day: 1, label: "Loyer", passed: true });
    expect(now.body.passedCents + now.body.upcomingCents).toBe(830_00);
  });
});
