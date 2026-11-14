import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { MAX_FAMILY_ACCOUNTS, generateFamilyCode, normalizeFamilyCode } from "../../src/lib/family";
import { authHeader, signup } from "../helpers";

const DAY = 86_400_000;

async function owner() {
  const { accessToken, user } = await signup(app, { name: "Anaïs Guyon" });
  return { auth: authHeader(accessToken), id: user.id };
}

const invite = async (auth: Record<string, string>, role: "full" | "planning") => (await request(app).post("/family/invite").set(auth).send({ role })).body.invite.code as string;

async function join(code: string, over: Record<string, unknown> = {}) {
  let n = 0;
  const email = `joiner${Date.now()}${n++}${Math.floor(Math.random() * 1e6)}@passerelle.test`;
  const res = await request(app).post("/auth/signup").send({ email, password: "password123", name: "Léa Martin", familyCode: code, age15: true, ...over });
  return { res, auth: res.status === 201 ? authHeader(res.body.accessToken) : {}, id: res.body.user?.id as string };
}

const addTask = (auth: Record<string, string>, title: string) => request(app).post("/tasks").set(auth).send({ title, weekday: 1, time: "08:00", category: "Maison" });
const titles = async (auth: Record<string, string>) => ((await request(app).get("/tasks").set(auth)).body.tasks as { title: string }[]).map((t) => t.title);
const addExpense = (auth: Record<string, string>, label: string) => request(app).post("/expenses").set(auth).send({ label, amountCents: 1000, category: "courses", date: "2026-11-05" });
const month = async (auth: Record<string, string>) => ((await request(app).get("/expenses?month=2026-11").set(auth)).body.expenses as { label: string }[]).map((e) => e.label);

describe("family codes", () => {
  it("are 8 unambiguous characters, forgiving when typed", () => {
    for (let i = 0; i < 50; i++) expect(generateFamilyCode()).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeFamilyCode(" k7f2 9qxa ")).toBe("K7F2-9QXA");
    expect(normalizeFamilyCode("K7F29QXA")).toBe("K7F2-9QXA");
    expect(normalizeFamilyCode("K7F2-9QX")).toBeNull();
    expect(normalizeFamilyCode("K7F2-9QX0")).toBeNull(); // 0 isn't in the alphabet
  });
});

describe("joining a family", () => {
  it("creates an account on the family's data, with a role and the family id", async () => {
    const a = await owner();
    const code = await invite(a.auth, "planning");
    const j = await join(code);
    expect(j.res.status).toBe(201);
    expect(j.res.body.user).toMatchObject({ familyId: a.id, familyRole: "planning" });
    const me = await request(app).get("/auth/me").set(j.auth);
    expect(me.body.user).toMatchObject({ id: j.id, familyId: a.id, familyRole: "planning" });
    // An owner reads as such.
    expect((await request(app).get("/auth/me").set(a.auth)).body.user).toMatchObject({ familyId: a.id, familyRole: "owner" });
  });

  it("needs a valid code, and the confirmation of being 15 or older", async () => {
    const a = await owner();
    const code = await invite(a.auth, "full");
    expect((await join(code, { age15: false })).res.status).toBe(400);
    expect((await join(code, { age15: undefined })).res.body.error).toContain("15 ans");
    // Creating one's own family is no different: 15 is the age for any account.
    const alone = await request(app).post("/auth/signup").send({ email: "alone@passerelle.test", password: "password123", name: "Sam" });
    expect(alone.status).toBe(400);
    expect(alone.body.error).toContain("15 ans");
    const wrong = await join("ZZZZ-ZZZZ");
    expect(wrong.res.status).toBe(400);
    expect(wrong.res.body.code).toBe("invalid_family_code");
    expect((await join("pas un code")).res.body.error).toContain("pas valide");
  });

  it("refuses an expired code, a replaced code, and a full family", async () => {
    const a = await owner();
    const old = await invite(a.auth, "full");
    await prisma.familyInvite.update({ where: { ownerId: a.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
    expect((await join(old)).res.body.error).toContain("expiré");

    const first = await invite(a.auth, "full");
    const second = await invite(a.auth, "full");
    expect(second).not.toBe(first);
    expect((await join(first)).res.body.error).toContain("n'existe pas");

    for (let i = 0; i < MAX_FAMILY_ACCOUNTS - 1; i++) expect((await join(second)).res.status).toBe(201);
    expect((await join(second)).res.body.error).toContain("complète");
  });

  it("is owner-only to create or revoke a code", async () => {
    const a = await owner();
    const j = await join(await invite(a.auth, "full"));
    expect((await request(app).post("/family/invite").set(j.auth).send({ role: "full" })).status).toBe(403);
    expect((await request(app).delete("/family/invite").set(j.auth)).status).toBe(403);
    expect((await request(app).delete("/family/invite").set(a.auth)).status).toBe(204);
    expect((await join("ABCD-EFGH")).res.status).toBe(400);
  });

  it("lists the accounts and shows the code only to the owner", async () => {
    const a = await owner();
    const code = await invite(a.auth, "planning");
    const j = await join(code);
    const asOwner = (await request(app).get("/family").set(a.auth)).body;
    expect(asOwner.role).toBe("owner");
    expect(asOwner.invite).toMatchObject({ code, role: "planning", expired: false });
    expect(asOwner.accounts.map((x: { role: string; isMe: boolean }) => [x.role, x.isMe])).toEqual([["owner", true], ["planning", false]]);
    const asJoiner = (await request(app).get("/family").set(j.auth)).body;
    expect(asJoiner.invite).toBeNull();
    expect(asJoiner.role).toBe("planning");
    expect(asJoiner.accounts.find((x: { isMe: boolean }) => x.isMe)).toMatchObject({ role: "planning" });
  });
});

describe("what is shared", () => {
  it("the planning is common to every account of the family, in both directions", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    const full = await join(await invite(a.auth, "full"));

    expect((await addTask(a.auth, "Courses du samedi")).status).toBe(201);
    expect((await addTask(planning.auth, "Piscine de Tom")).status).toBe(201);
    expect((await addTask(full.auth, "Réunion d'école")).status).toBe(201);
    const expected = ["Courses du samedi", "Piscine de Tom", "Réunion d'école"];
    for (const who of [a, planning, full]) expect((await titles(who.auth)).sort()).toEqual(expected);

    // Shopping and members are family data too.
    await request(app).post("/shopping").set(planning.auth).send({ label: "Lait" });
    expect(((await request(app).get("/shopping").set(a.auth)).body.items as { label: string }[]).map((i) => i.label)).toEqual(["Lait"]);
  });

  it("a « full » account shares the budget and documents with the owner", async () => {
    const a = await owner();
    const full = await join(await invite(a.auth, "full"));
    await addExpense(a.auth, "Boulangerie");
    await addExpense(full.auth, "Pharmacie");
    expect((await month(full.auth)).sort()).toEqual(["Boulangerie", "Pharmacie"]);
    expect((await month(a.auth)).sort()).toEqual(["Boulangerie", "Pharmacie"]);
  });

  it("a « planning » account keeps its own budget, and the owner's stays private", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    await addExpense(a.auth, "Loyer");
    expect(await month(planning.auth)).toEqual([]);
    await addExpense(planning.auth, "Cinéma");
    expect(await month(planning.auth)).toEqual(["Cinéma"]);
    expect(await month(a.auth)).toEqual(["Loyer"]);
    // Its own categories too.
    await request(app).post("/expense-categories").set(planning.auth).send({ name: "Argent de poche" });
    expect(((await request(app).get("/expense-categories").set(a.auth)).body.categories as unknown[]).length).toBe(0);
  });

  it("a « planning » account can tag a family member on its own expense", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    const member = (await request(app).post("/members").set(a.auth).send({ name: "Tom", age: 9 })).body.member;
    const res = await request(app).post("/expenses").set(planning.auth).send({ label: "Football", amountCents: 2500, category: "loisirs", date: "2026-11-05", memberId: member.id });
    expect(res.status).toBe(201);
    // …but not a member of someone else's family.
    const other = await owner();
    const foreign = (await request(app).post("/members").set(other.auth).send({ name: "Zoé" })).body.member;
    expect((await request(app).post("/expenses").set(planning.auth).send({ label: "X", amountCents: 100, category: "divers", date: "2026-11-05", memberId: foreign.id })).status).toBe(400);
  });

  it("documents: the library is private for « planning », recipe attachments are the family's", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    await prisma.document.create({ data: { userId: a.id, title: "Assurance", category: "assurance", fileKey: "k1", fileName: "a.pdf", mimeType: "application/pdf", size: 10, status: "ready" } });
    await prisma.document.create({ data: { userId: planning.id, title: "Mon bulletin", category: "école", fileKey: "k2", fileName: "b.pdf", mimeType: "application/pdf", size: 10, status: "ready" } });
    const titlesOf = async (auth: Record<string, string>) => ((await request(app).get("/documents").set(auth)).body.documents as { title: string }[]).map((d) => d.title);
    expect(await titlesOf(a.auth)).toEqual(["Assurance"]);
    expect(await titlesOf(planning.auth)).toEqual(["Mon bulletin"]);

    // A recipe's attachment is visible to both and the planning account can open it.
    const recipe = (await request(app).post("/recipes").set(a.auth).send({ title: "Gratin", ingredients: ["courgettes"] })).body.recipe;
    const att = await prisma.document.create({ data: { userId: a.id, recipeId: recipe.id, title: "Photo", category: "autre", fileKey: "k3", fileName: "p.jpg", mimeType: "image/jpeg", size: 10, status: "ready" } });
    const forRecipe = async (auth: Record<string, string>) => ((await request(app).get(`/documents?recipeId=${recipe.id}`).set(auth)).body.documents as { title: string }[]).map((d) => d.title);
    expect(await forRecipe(a.auth)).toEqual(["Photo"]);
    expect(await forRecipe(planning.auth)).toEqual(["Photo"]);
    expect((await request(app).patch(`/documents/${att.id}`).set(planning.auth).send({ title: "Photo du gratin", category: "autre", memberId: null })).status).toBe(200);
    // The owner's private document isn't reachable by id from the planning account.
    const priv = await prisma.document.findFirstOrThrow({ where: { userId: a.id, recipeId: null } });
    expect((await request(app).patch(`/documents/${priv.id}`).set(planning.auth).send({ title: "x", category: "autre", memberId: null })).status).toBe(404);
  });
});

describe("one subscription for the family", () => {
  it("packs and trial of the owner apply to every account", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    // Not subscribed yet: Budget+ is locked for the joiner too.
    expect((await request(app).post("/savings-goals").set(planning.auth).send({ name: "Vacances", targetCents: 50_000, deadline: null })).status).toBe(403);

    await prisma.user.update({ where: { id: a.id }, data: { budgetUntil: new Date(Date.now() + 30 * DAY) } });
    const plan = (await request(app).get("/plan").set(planning.auth)).body;
    expect(plan.packs.budget.active).toBe(true);
    expect((await request(app).post("/savings-goals").set(planning.auth).send({ name: "Vacances", targetCents: 50_000, deadline: null })).status).toBe(201);
  });

  it("the trial started by a joiner is the family's, and only once", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    expect((await request(app).post("/plan/trial/budget").set(planning.auth)).status).toBe(201);
    expect((await request(app).get("/plan").set(a.auth)).body.packs.budget.trial.active).toBe(true);
    expect((await request(app).post("/plan/trial/budget").set(a.auth)).status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: planning.id } })).budgetTrialStartedAt).toBeNull();
  });

  it("meal generation quota is shared (counted on the family)", async () => {
    const a = await owner();
    const planning = await join(await invite(a.auth, "planning"));
    await prisma.mealGeneration.create({ data: { userId: a.id, kind: "week" } });
    const q = (await request(app).get("/plan").set(planning.auth)).body.meals;
    expect(q.weeksUsed).toBe(1);
  });
});

describe("leaving, removing, deleting", () => {
  it("the owner removes an account: it keeps existing, alone and without the family", async () => {
    const a = await owner();
    const j = await join(await invite(a.auth, "full"));
    await addTask(a.auth, "Tâche de la famille");
    expect(await titles(j.auth)).toEqual(["Tâche de la famille"]);

    expect((await request(app).delete(`/family/accounts/${j.id}`).set(a.auth)).status).toBe(204);
    // Same token, but now its own (empty) family.
    expect(await titles(j.auth)).toEqual([]);
    expect((await request(app).get("/auth/me").set(j.auth)).body.user).toMatchObject({ familyId: j.id, familyRole: "owner" });
    // Someone else's account can't be removed.
    const b = await owner();
    expect((await request(app).delete(`/family/accounts/${b.id}`).set(a.auth)).status).toBe(404);
  });

  it("an account can leave; the owner cannot", async () => {
    const a = await owner();
    const j = await join(await invite(a.auth, "planning"));
    expect((await request(app).post("/family/leave").set(a.auth)).status).toBe(400);
    expect((await request(app).post("/family/leave").set(j.auth)).status).toBe(204);
    expect(await titles(j.auth)).toEqual([]);
    expect(((await request(app).get("/family").set(a.auth)).body.accounts as unknown[]).length).toBe(1);
  });

  it("a joiner deleting its account leaves the family untouched", async () => {
    const a = await owner();
    const j = await join(await invite(a.auth, "planning"));
    await addTask(a.auth, "Reste");
    await addExpense(j.auth, "Privé");
    const del = await request(app).delete("/auth/me").set(j.auth).send({ password: "password123" });
    expect(del.status).toBe(204);
    expect(await titles(a.auth)).toEqual(["Reste"]);
    expect(await prisma.expense.count({ where: { userId: j.id } })).toBe(0);
  });

  it("the owner deleting the account must confirm when others use the family, and an adult takes it over", async () => {
    const a = await owner();
    const j = await join(await invite(a.auth, "full"));
    await addTask(a.auth, "Famille");
    await addExpense(a.auth, "Courses partagées");

    const refused = await request(app).delete("/auth/me").set(a.auth).send({ password: "password123" });
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ code: "family_has_members", members: 1, heir: "Léa Martin" });
    expect(refused.body.error).toContain("reprendra");
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(1);

    expect((await request(app).delete("/auth/me").set(a.auth).send({ password: "password123", confirmFamily: true })).status).toBe(204);
    // The adult now owns the family: same planning and budget, on their own account.
    const me = (await request(app).get("/auth/me").set(j.auth)).body.user;
    expect(me).toMatchObject({ id: j.id, familyId: j.id, familyRole: "owner", familyNotice: { kind: "heir", from: "Anaïs Guyon" } });
    expect(await titles(j.auth)).toEqual(["Famille"]);
    expect(await month(j.auth)).toEqual(["Courses partagées"]);
    // They start from the free offer: the departed owner's subscription doesn't follow.
    const plan = (await request(app).get("/plan").set(j.auth)).body;
    expect(plan.packs.budget.active).toBe(false);
    // And can invite people again.
    expect((await request(app).post("/family/invite").set(j.auth).send({ role: "planning" })).status).toBe(201);
  });

  it("the other accounts follow the new owner, with their own space kept and a gentle notice", async () => {
    const a = await owner();
    const adult = await join(await invite(a.auth, "full"), { name: "Marc Dupont" });
    const teen = await join(await invite(a.auth, "planning"), { name: "Lou Martin" });
    await addTask(a.auth, "Famille");
    await addExpense(teen.auth, "Argent de poche");

    expect((await request(app).delete("/auth/me").set(a.auth).send({ password: "password123", confirmFamily: true })).status).toBe(204);

    const me = (await request(app).get("/auth/me").set(teen.auth)).body.user;
    expect(me).toMatchObject({ familyId: adult.id, familyRole: "planning", familyNotice: { kind: "newOwner", from: "Anaïs Guyon", heir: "Marc Dupont" } });
    expect(await titles(teen.auth)).toEqual(["Famille"]);
    expect(await month(teen.auth)).toEqual(["Argent de poche"]);

    // Closing the message makes it go away.
    expect((await request(app).delete("/family/notice").set(teen.auth)).status).toBe(204);
    expect((await request(app).get("/auth/me").set(teen.auth)).body.user.familyNotice).toBeNull();
  });

  it("can name who takes over, and only among the adults", async () => {
    const a = await owner();
    const first = await join(await invite(a.auth, "full"), { name: "Marc Dupont" });
    const second = await join(await invite(a.auth, "full"), { name: "Sam Roux" });
    const teen = await join(await invite(a.auth, "planning"), { name: "Lou Martin" });
    const bad = await request(app).delete("/auth/me").set(a.auth).send({ password: "password123", confirmFamily: true, heirId: teen.id });
    expect(bad.status).toBe(400);
    expect((await request(app).delete("/auth/me").set(a.auth).send({ password: "password123", confirmFamily: true, heirId: second.id })).status).toBe(204);
    expect((await request(app).get("/auth/me").set(second.auth)).body.user.familyRole).toBe("owner");
    expect((await request(app).get("/auth/me").set(first.auth)).body.user).toMatchObject({ familyId: second.id, familyRole: "full" });
  });

  it("with no adult to take over, the others keep their account and private data but not the shared planning", async () => {
    const a = await owner();
    const teen = await join(await invite(a.auth, "planning"), { name: "Lou Martin" });
    await addTask(a.auth, "Famille");
    await addExpense(teen.auth, "Argent de poche");
    const refused = await request(app).delete("/auth/me").set(a.auth).send({ password: "password123" });
    expect(refused.body).toMatchObject({ code: "family_has_members", heir: null });
    expect((await request(app).delete("/auth/me").set(a.auth).send({ password: "password123", confirmFamily: true })).status).toBe(204);
    const me = (await request(app).get("/auth/me").set(teen.auth)).body.user;
    expect(me).toMatchObject({ familyId: teen.id, familyRole: "owner", familyNotice: { kind: "detached", from: "Anaïs Guyon" } });
    expect(await titles(teen.auth)).toEqual([]);
    expect(await month(teen.auth)).toEqual(["Argent de poche"]);
  });

  it("an owner without anyone else deletes without extra confirmation", async () => {
    const a = await owner();
    expect((await request(app).delete("/auth/me").set(a.auth).send({ password: "password123" })).status).toBe(204);
  });
});

describe("joining a family from an existing account", () => {
  const joinNow = (auth: Record<string, string>, body: Record<string, unknown>) => request(app).post("/family/join").set(auth).send(body);

  it("lets an empty account join with a code, with the profile the code carries", async () => {
    const a = await owner();
    await addTask(a.auth, "Famille");
    const b = await owner();
    const res = await joinNow(b.auth, { code: await invite(a.auth, "planning") });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: b.id, familyId: a.id, familyRole: "planning" });
    expect(await titles(b.auth)).toEqual(["Famille"]);
    // The code was theirs to use once; the owner sees the new account.
    const info = (await request(app).get("/family").set(a.auth)).body;
    expect(info.accounts).toHaveLength(2);
  });

  it("refuses a bad, expired or own code, and an account that is already in a family", async () => {
    const a = await owner();
    const b = await owner();
    const wrong = await joinNow(b.auth, { code: "ZZZZ-ZZZZ" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("invalid_family_code");
    const own = await joinNow(a.auth, { code: await invite(a.auth, "full") });
    expect(own.body.code).toBe("own_code");

    const code = await invite(a.auth, "full");
    expect((await joinNow(b.auth, { code })).status).toBe(200);
    const c = await owner();
    const second = await joinNow(b.auth, { code: await invite(c.auth, "full") });
    expect(second.status).toBe(400);
    expect(second.body.code).toBe("already_in_family");
  });

  it("refuses a creator who already has other accounts in the family", async () => {
    const a = await owner();
    await join(await invite(a.auth, "full"));
    const other = await owner();
    const res = await joinNow(a.auth, { code: await invite(other.auth, "full") });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("family_has_members");
  });

  it("asks before erasing what the account already holds, then needs the password", async () => {
    const a = await owner();
    await addTask(a.auth, "Famille");
    const b = await owner();
    await addTask(b.auth, "À moi");
    await addExpense(b.auth, "Privé");
    const code = await invite(a.auth, "full");

    const asked = await joinNow(b.auth, { code });
    expect(asked.status).toBe(409);
    expect(asked.body).toMatchObject({ code: "account_not_empty", counts: { tasks: 1, expenses: 1 } });
    expect(await titles(b.auth)).toEqual(["À moi"]);

    expect((await joinNow(b.auth, { code, erase: true })).status).toBe(401);
    expect((await joinNow(b.auth, { code, erase: true, password: "mauvais" })).status).toBe(401);
    expect(await titles(b.auth)).toEqual(["À moi"]);

    const done = await joinNow(b.auth, { code, erase: true, password: "password123" });
    expect(done.status).toBe(200);
    expect(await titles(b.auth)).toEqual(["Famille"]);
    expect(await prisma.task.count({ where: { userId: b.id } })).toBe(0);
    expect(await prisma.expense.count({ where: { userId: b.id } })).toBe(0);
  });
});
