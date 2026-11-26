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

describe("Comptes partagés — lien d'une personne", () => {
  it("lets Marc see the group with his link, add his own expense, and edit only his own", async () => {
    const { auth, id, ids } = await newGroup(["Anaïs", "Marc"]);
    const { prisma } = await import("../../src/db");
    const { setPushSender } = await import("../../src/lib/familyAlerts");
    const sent: { body: string; data?: unknown }[] = [];
    setPushSender(async (m) => {
      sent.push(...m);
    });
    try {
      const owner = (await request(app).get("/splits").set(auth)).body.groups[0];
      const familyId = (await prisma.splitGroup.findUniqueOrThrow({ where: { id: owner.id } })).userId;
      await prisma.pushToken.create({ data: { userId: familyId, token: "ExponentPushToken[anais]" } });

      // The family makes Marc's link: only the family sees the secret.
      const made = await request(app).post(`/splits/${id}/participants/${ids.Marc}/link`).set(auth);
      const token = made.body.group.participants.find((p: { id: string }) => p.id === ids.Marc).linkToken as string;
      expect(token).toMatch(/^[\w-]{24}$/);

      const page = await request(app).get(`/s/${token}`);
      expect(page.status).toBe(200);
      expect(page.text).toContain("Comptes partagés");
      expect(page.headers["x-robots-tag"]).toContain("noindex");

      const data = await request(app).get(`/s/${token}/data`);
      expect(data.body.me).toBe(ids.Marc);
      expect(data.body.group.participants.every((p: { linkToken?: string }) => p.linkToken === undefined)).toBe(true);

      // An expense of the family, and one Marc adds through his link.
      const fam = await request(app).post(`/splits/${id}/expenses`).set(auth).send({ title: "Cantine", amountCents: 8000, paidById: ids["Anaïs"], date: "2026-11-20", shares: [{ participantId: ids["Anaïs"], value: 1 }, { participantId: ids.Marc, value: 1 }] });
      const added = await request(app).post(`/s/${token}/expenses`).send({ title: "Foot", amountCents: 12000, paidById: ids.Marc, date: "2026-11-21", shares: [{ participantId: ids["Anaïs"], value: 1 }, { participantId: ids.Marc, value: 1 }] });
      expect(added.status).toBe(201);
      const foot = added.body.group.expenses.find((e: { title: string }) => e.title === "Foot");
      expect(foot.addedById).toBe(ids.Marc);
      await new Promise((r) => setTimeout(r, 50));
      expect(sent.map((m) => m.body)).toEqual([expect.stringContaining("Marc a ajouté « Foot »")]);
      expect(sent[0].data).toEqual({ url: `/comptes/${id}` });

      // Marc can change his own expense, not the family's.
      const body = { title: "Foot (licence)", amountCents: 12000, paidById: ids.Marc, date: "2026-11-21", shares: [{ participantId: ids["Anaïs"], value: 1 }, { participantId: ids.Marc, value: 1 }] };
      expect((await request(app).put(`/s/${token}/expenses/${foot.id}`).send(body)).status).toBe(200);
      expect((await request(app).put(`/s/${token}/expenses/${fam.body.expenseId}`).send(body)).status).toBe(403);
      expect((await request(app).delete(`/s/${token}/expenses/${fam.body.expenseId}`)).status).toBe(403);

      // Cutting the link stops it at once.
      await request(app).delete(`/splits/${id}/participants/${ids.Marc}/link`).set(auth);
      expect((await request(app).get(`/s/${token}/data`)).status).toBe(404);
      expect((await request(app).get(`/s/${token}`)).text).toContain("n'est plus valable");
    } finally {
      setPushSender(null);
    }
  });

  it("keeps an archived group read-only through a person's link", async () => {
    const { auth, id, ids } = await newGroup(["Anaïs", "Marc"]);
    const made = await request(app).post(`/splits/${id}/participants/${ids.Marc}/link`).set(auth);
    const token = made.body.group.participants.find((p: { id: string }) => p.id === ids.Marc).linkToken as string;
    await request(app).patch(`/splits/${id}`).set(auth).send({ archived: true });
    expect((await request(app).get(`/s/${token}/data`)).status).toBe(200);
    const body = { title: "Après coup", amountCents: 1000, paidById: ids.Marc, date: "2026-11-25", shares: [{ participantId: ids.Marc, value: 1 }] };
    expect((await request(app).post(`/s/${token}/expenses`).send(body)).status).toBe(403);
  });
});
