import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { setStorageForTests, type Storage } from "../../src/lib/storage";
import { authHeader, signup } from "../helpers";

class FakeStorage implements Storage {
  removed: string[] = [];
  async uploadUrl(key: string) {
    return `https://bucket.test/${key}?put`;
  }
  async downloadUrl(key: string) {
    return `https://bucket.test/${key}?get`;
  }
  async size() {
    return 1000;
  }
  async remove(key: string) {
    this.removed.push(key);
  }
}

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
  setStorageForTests(storage);
});
afterEach(() => setStorageForTests(undefined));

async function newGroup(names = ["Anaïs", "Marc", "Julie"]) {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const res = await request(app).post("/splits").set(auth).send({ name: "Vacances", participants: names.map((name) => ({ name })) });
  expect(res.status).toBe(201);
  const ids = Object.fromEntries(res.body.group.participants.map((p: { id: string; name: string }) => [p.name, p.id])) as Record<string, string>;
  return { auth, id: res.body.group.id as string, ids };
}

describe("Comptes partagés", () => {
  it("adds expenses with the four kinds of split and works out who owes whom", async () => {
    const { auth, id, ids } = await newGroup();
    const url = `/splits/${id}/expenses`;
    const everyone = Object.values(ids).map((participantId) => ({ participantId, value: 0 }));
    // 90 € paid by Anaïs, equally.
    expect((await request(app).post(url).set(auth).send({ title: "Courses", amountCents: 9000, paidById: ids["Anaïs"], date: "2026-11-24", shares: everyone })).status).toBe(201);
    // 30 € paid by Marc, in shares (Julie 2, Marc 1).
    const r = await request(app)
      .post(url)
      .set(auth)
      .send({ title: "Glaces", amountCents: 3000, paidById: ids.Marc, date: "2026-11-24", mode: "shares", shares: [{ participantId: ids.Julie, value: 2 }, { participantId: ids.Marc, value: 1 }] });
    expect(r.status).toBe(201);
    const g = r.body.group;
    const bal = Object.fromEntries(g.balances.map((b: { participantId: string; cents: number }) => [b.participantId, b.cents]));
    // Anaïs +60 ; Marc −30 +30 −10 = −10 ; Julie −30 −20 = −50.
    expect(bal).toEqual({ [ids["Anaïs"]]: 6000, [ids.Marc]: -1000, [ids.Julie]: -5000 });
    expect(g.transfers).toEqual([
      { fromId: ids.Julie, toId: ids["Anaïs"], amountCents: 5000 },
      { fromId: ids.Marc, toId: ids["Anaïs"], amountCents: 1000 },
    ]);
    expect(g.spentCents).toBe(12000);
    expect(g.expenses).toHaveLength(2);

    // Wrong percentages are refused with a clear message.
    const bad = await request(app)
      .post(url)
      .set(auth)
      .send({ title: "Essence", amountCents: 5000, paidById: ids.Marc, date: "2026-11-24", mode: "percent", shares: [{ participantId: ids.Marc, value: 5000 }, { participantId: ids.Julie, value: 4000 }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("90 %");

    // Julie pays Anaïs back: balanced for her.
    const settled = await request(app).post(`/splits/${id}/settle`).set(auth).send({ fromId: ids.Julie, toId: ids["Anaïs"], amountCents: 5000 });
    expect(settled.status).toBe(201);
    expect(settled.body.group.transfers).toEqual([{ fromId: ids.Marc, toId: ids["Anaïs"], amountCents: 1000 }]);
    expect(settled.body.group.expenses[0]).toMatchObject({ kind: "transfer", title: "Julie → Anaïs" });
    // A transfer isn't spending.
    expect(settled.body.group.spentCents).toBe(12000);
  });

  it("remembers a split, keeps a ticket photo, and lists the family's groups only", async () => {
    const { auth, id, ids } = await newGroup(["Anaïs", "Marc"]);
    const r = await request(app)
      .post(`/splits/${id}/expenses`)
      .set(auth)
      .send({
        title: "Cantine",
        amountCents: 10000,
        paidById: ids["Anaïs"],
        date: "2026-11-20",
        mode: "percent",
        remember: true,
        shares: [{ participantId: ids["Anaïs"], value: 6000 }, { participantId: ids.Marc, value: 4000 }],
        photo: { mimeType: "image/jpeg", size: 200_000 },
      });
    expect(r.status).toBe(201);
    expect(r.body.upload.url).toContain("?put");
    expect(r.body.group.defaultSplit).toEqual({ mode: "percent", values: { [ids["Anaïs"]]: 6000, [ids.Marc]: 4000 } });
    expect(r.body.group.expenses[0].photoUrl).toContain("?get");

    const list = await request(app).get("/splits").set(auth);
    expect(list.body.groups).toHaveLength(1);
    expect(list.body.groups[0]).toMatchObject({ name: "Vacances", spentCents: 10000, expenseCount: 1 });

    const other = authHeader((await signup(app)).accessToken);
    expect((await request(app).get(`/splits/${id}`).set(other)).status).toBe(404);
    expect((await request(app).get("/splits").set(other)).body.groups).toEqual([]);

    // Deleting the expense removes its photo.
    await request(app).delete(`/splits/${id}/expenses/${r.body.expenseId}`).set(auth);
    expect(storage.removed).toHaveLength(1);
  });

  it("manages people: add, rename, and no removal while they appear in an expense", async () => {
    const { auth, id, ids } = await newGroup(["Anaïs", "Marc"]);
    const added = await request(app).post(`/splits/${id}/participants`).set(auth).send({ name: "Léo" });
    expect(added.body.group.participants.map((p: { name: string }) => p.name)).toEqual(["Anaïs", "Marc", "Léo"]);
    await request(app).post(`/splits/${id}/expenses`).set(auth).send({ title: "Pizza", amountCents: 1200, paidById: ids.Marc, date: "2026-11-24", shares: [{ participantId: ids.Marc, value: 0 }, { participantId: ids["Anaïs"], value: 0 }] });
    expect((await request(app).delete(`/splits/${id}/participants/${ids.Marc}`).set(auth)).status).toBe(409);
    const leo = added.body.group.participants.find((p: { name: string }) => p.name === "Léo").id;
    expect((await request(app).delete(`/splits/${id}/participants/${leo}`).set(auth)).status).toBe(200);
    expect((await request(app).post("/splits").set(auth).send({ name: "Seul", participants: [{ name: "Moi" }] })).status).toBe(400);
  });
});
