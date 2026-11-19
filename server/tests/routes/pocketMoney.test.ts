import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";
import { catchUpPocketMoney, nextPayDay, payDays } from "../../src/lib/pocketMoney";

async function familyWithChildAccount() {
  const parent = await signup(app);
  const auth = authHeader(parent.accessToken);
  const member = (await request(app).post("/members").set(auth).send({ name: "Jules", initials: "J", age: 10 })).body.member;
  const { code } = (await request(app).post(`/family/children/${member.id}/code`).set(auth)).body;
  const login = await request(app).post("/auth/child-code").send({ code });
  return { auth, space: { ...auth, "X-Child-Space": member.id }, childAuth: authHeader(login.body.accessToken), childId: login.body.user.id as string };
}

describe("payDays", () => {
  it("weekly on a weekday, monthly on a date", () => {
    // 2026-11-21 = samedi (5).
    expect(payDays({ frequency: "weekly", day: 5 }, "2026-11-16", "2026-11-30")).toEqual(["2026-11-21", "2026-11-28"]);
    expect(payDays({ frequency: "monthly", day: 1 }, "2026-11-15", "2027-01-10")).toEqual(["2026-12-01", "2027-01-01"]);
    expect(nextPayDay({ frequency: "weekly", day: 5 }, "2026-11-22")).toBe("2026-11-28");
  });
});

describe("pocket money", () => {
  it("a parent sets weekly pocket money; credits come due; spending is deducted", async () => {
    const { space, childAuth, childId } = await familyWithChildAccount();
    expect((await request(app).put("/pocket-money/rule").set(space).send({ amountCents: 500, frequency: "weekly", day: 5 })).status).toBe(204);
    // L'enfant ne règle rien.
    expect((await request(app).put("/pocket-money/rule").set(childAuth).send({ amountCents: 9900, frequency: "weekly", day: 5 })).status).toBe(403);

    // Simule trois semaines écoulées depuis le début.
    await prisma.pocketMoneyRule.update({ where: { accountId: childId }, data: { startDay: "2026-11-01" } });
    await catchUpPocketMoney(childId, "2026-11-21");
    await catchUpPocketMoney(childId, "2026-11-21"); // pas de doublon
    expect(await prisma.pocketMoneyCredit.count({ where: { accountId: childId } })).toBe(3); // 7, 14, 21 nov.

    await request(app).post("/pocket-money/credits").set(space).send({ amountCents: 2000, label: "Anniversaire de mamie" });
    await request(app).post("/expenses").set(childAuth).send({ label: "Bonbons", amountCents: 250, category: "loisirs", date: "2026-11-10" });

    const view = (await request(app).get("/pocket-money").set(childAuth)).body;
    expect(view.rule).toMatchObject({ amountCents: 500, frequency: "weekly", day: 5 });
    expect(view.receivedCents).toBeGreaterThanOrEqual(3500);
    expect(view.spentCents).toBe(250);
    expect(view.balanceCents).toBe(view.receivedCents - 250);
    expect(view.credits.some((c: { label: string }) => c.label === "Anniversaire de mamie")).toBe(true);

    // Le parent voit la même chose depuis l'espace de l'enfant, et peut retirer un versement.
    const parentView = (await request(app).get("/pocket-money").set(space)).body;
    expect(parentView.balanceCents).toBe(view.balanceCents);
    const manual = parentView.credits.find((c: { source: string }) => c.source === "manual");
    expect((await request(app).delete(`/pocket-money/credits/${manual.id}`).set(space)).status).toBe(204);
    expect((await request(app).delete("/pocket-money/rule").set(space)).status).toBe(204);
    expect((await request(app).get("/pocket-money").set(space)).body.rule).toBeNull();
  });

  it("is only for child accounts", async () => {
    const { auth } = await familyWithChildAccount();
    expect((await request(app).get("/pocket-money").set(auth)).body.code).toBe("not_a_child");
  });
});
