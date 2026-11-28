import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("/birthdays", () => {
  it("keeps friends' birthdays, gift ideas and the reminder delay; children never see gifts", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const leo = (await request(app).post("/members").set(auth).send({ name: "Léo", initials: "L", age: 12 })).body.member;

    expect((await request(app).get("/birthdays").set(auth)).body).toEqual({ remindDays: 7, contacts: [], gifts: [] });
    const mamie = (await request(app).post("/birthdays/contacts").set(auth).send({ name: "Mamie", birthday: "1950-03-14", yearKnown: true, relation: "Grand-mère" })).body.contact;
    expect(mamie).toMatchObject({ name: "Mamie", birthday: "1950-03-14", yearKnown: true });
    const ami = (await request(app).post("/birthdays/contacts").set(auth).send({ name: "Tom", birthday: "2026-06-02" })).body.contact;
    expect(ami.birthday).toBe("2000-06-02");

    const g1 = (await request(app).post("/birthdays/gifts").set(auth).send({ contactId: mamie.id, title: "Un livre de jardin" })).body.gift;
    await request(app).post("/birthdays/gifts").set(auth).send({ memberId: leo.id, title: "Un ballon" });
    expect((await request(app).post("/birthdays/gifts").set(auth).send({ title: "Pour qui ?" })).status).toBe(400);
    expect((await request(app).patch(`/birthdays/gifts/${g1.id}`).set(auth).send({ bought: true })).body.gift.bought).toBe(true);
    expect((await request(app).put("/birthdays/settings").set(auth).send({ remindDays: 3 })).body.remindDays).toBe(3);

    const all = (await request(app).get("/birthdays").set(auth)).body;
    expect(all.remindDays).toBe(3);
    expect(all.contacts.map((c: { name: string }) => c.name)).toEqual(["Mamie", "Tom"]);
    expect(all.gifts).toHaveLength(2);

    // Le compte de Léo : les dates, pas les cadeaux (surprise !), et rien à modifier.
    const code = (await request(app).post(`/family/children/${leo.id}/code`).set(auth)).body.code;
    const childAuth = authHeader((await request(app).post("/auth/child-code").send({ code })).body.accessToken);
    const seen = (await request(app).get("/birthdays").set(childAuth)).body;
    expect(seen.contacts).toHaveLength(2);
    expect(seen.gifts).toEqual([]);
    expect((await request(app).post("/birthdays/gifts").set(childAuth).send({ memberId: leo.id, title: "x" })).status).toBe(403);

    // Supprimer un proche supprime ses idées.
    await request(app).delete(`/birthdays/contacts/${mamie.id}`).set(auth);
    expect((await request(app).get("/birthdays").set(auth)).body.gifts).toHaveLength(1);

    // Une autre famille ne voit rien.
    const other = authHeader((await signup(app)).accessToken);
    expect((await request(app).patch(`/birthdays/contacts/${ami.id}`).set(other).send({ name: "x" })).status).toBe(404);
  });
});
