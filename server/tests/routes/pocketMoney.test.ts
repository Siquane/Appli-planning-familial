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
  return { auth, memberId: member.id as string, space: { ...auth, "X-Child-Space": member.id }, childAuth: authHeader(login.body.accessToken), childId: login.body.user.id as string };
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

  it("advances: the child owes, repays when they want from the kitty, never more than they have", async () => {
    const { auth, memberId, space, childAuth } = await familyWithChildAccount();
    // 20 € in the kitty.
    await request(app).post("/pocket-money/credits").set(space).send({ amountCents: 2000, label: "Anniversaire" });

    // From the Comptes tab: the parent advances 15 € for a game.
    const made = await request(app).post("/pocket-money/advances/family").set(auth).send({ memberId, amountCents: 1500, label: "Jeu vidéo" });
    expect(made.status).toBe(201);
    expect((await request(app).post("/pocket-money/advances/family").set(childAuth).send({ memberId, amountCents: 100, label: "x" })).status).toBe(403);

    const family = await request(app).get("/pocket-money/advances/family").set(auth);
    expect(family.body.children).toEqual([expect.objectContaining({ memberId, owedCents: 1500, advances: [expect.objectContaining({ label: "Jeu vidéo", leftCents: 1500 })] })]);

    // The child sees it with their pocket money, and pays 5 € back.
    let view = (await request(app).get("/pocket-money").set(childAuth)).body;
    expect(view).toMatchObject({ owedCents: 1500, balanceCents: 2000 });
    const id = view.advances[0].id;
    const part = await request(app).post(`/pocket-money/advances/${id}/repay`).set(childAuth).send({ amountCents: 500 });
    expect(part.body.advance).toMatchObject({ repaidCents: 500, leftCents: 1000 });
    view = (await request(app).get("/pocket-money").set(childAuth)).body;
    expect(view).toMatchObject({ owedCents: 1000, balanceCents: 1500, receivedCents: 2000 });
    expect(view.credits[0]).toMatchObject({ amountCents: -500, label: "Remboursé : Jeu vidéo", source: "repay" });
    // A repayment can't be removed from the history (it would unbalance the advance).
    expect((await request(app).delete(`/pocket-money/credits/${view.credits[0].id}`).set(space)).status).toBe(404);

    // Never more than what is in the kitty.
    await request(app).post("/pocket-money/advances").set(space).send({ amountCents: 5000, label: "Vélo" });
    const big = (await request(app).get("/pocket-money").set(childAuth)).body.advances.find((a: { label: string }) => a.label === "Vélo");
    const tooMuch = await request(app).post(`/pocket-money/advances/${big.id}/repay`).set(childAuth).send({});
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.code).toBe("not_enough");

    // The rest of the game: repaid in full, nothing left to repay.
    expect((await request(app).post(`/pocket-money/advances/${id}/repay`).set(childAuth).send({})).body.advance.leftCents).toBe(0);
    expect((await request(app).post(`/pocket-money/advances/${id}/repay`).set(childAuth).send({})).status).toBe(409);
    expect((await request(app).get("/pocket-money").set(childAuth)).body).toMatchObject({ owedCents: 5000, balanceCents: 500 });

    // The child can't create, cancel or read the adults' shared accounts.
    expect((await request(app).post("/pocket-money/advances").set(childAuth).send({ amountCents: 100, label: "x" })).status).toBe(403);
    expect((await request(app).delete(`/pocket-money/advances/${big.id}`).set(childAuth)).status).toBe(403);
    expect((await request(app).get("/splits").set(childAuth)).status).toBe(403);
  });
});
