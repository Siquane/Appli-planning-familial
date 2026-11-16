import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { alertBody, flushFamilyAlerts, setPushSender, type PushMessage } from "../../src/lib/familyAlerts";
import { authHeader, signup } from "../helpers";

let sent: PushMessage[] = [];
beforeEach(async () => {
  await flushFamilyAlerts();
  sent = [];
  setPushSender(async (messages) => {
    sent.push(...messages);
  });
});
afterAll(() => setPushSender(null));

const task = { title: "Piscine", category: "Loisirs", weekday: 2, time: "17:00" };

async function family() {
  const owner = await signup(app, { name: "Anaïs" });
  const ownerAuth = authHeader(owner.accessToken);
  const code = (await request(app).post("/family/invite").set(ownerAuth).send({ role: "planning" })).body.invite.code;
  const res = await request(app)
    .post("/auth/signup")
    .send({ email: `lea${Date.now()}${Math.random()}@passerelle.test`, password: "password123", name: "Léa", familyCode: code, age15: true });
  return { ownerAuth, joinerAuth: authHeader(res.body.accessToken as string) };
}

describe("alertBody", () => {
  it("lists what changed in a fixed order", () => {
    expect(alertBody("Léa", ["courses", "planning"])).toBe("Léa a modifié le planning et la liste de courses.");
    expect(alertBody("", ["menu"])).toBe("Quelqu'un a modifié le menu de la semaine.");
  });
});

describe("family change alerts", () => {
  it("sends one grouped notification to the other accounts only", async () => {
    const { ownerAuth, joinerAuth } = await family();
    expect((await request(app).put("/notifications/push-token").set(ownerAuth).send({ token: "ExponentPushToken[owner]" })).status).toBe(204);
    await request(app).put("/notifications/push-token").set(joinerAuth).send({ token: "ExponentPushToken[joiner]" });

    await request(app).post("/tasks").set(joinerAuth).send(task);
    await request(app).post("/tasks").set(joinerAuth).send({ ...task, weekday: 4 });
    await request(app).post("/shopping").set(joinerAuth).send({ label: "Lait" });
    await flushFamilyAlerts();

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "ExponentPushToken[owner]", body: "Léa a modifié le planning et la liste de courses.", data: { url: "/home" } });
  });

  it("ignores reads, failed writes and routes that save nothing", async () => {
    const { ownerAuth, joinerAuth } = await family();
    await request(app).put("/notifications/push-token").set(ownerAuth).send({ token: "ExponentPushToken[owner]" });

    await request(app).get("/tasks").set(joinerAuth);
    await request(app).post("/tasks").set(joinerAuth).send({ title: "" });
    await request(app).post("/recipes/import").set(joinerAuth).send({ url: "http://localhost/x" });
    await flushFamilyAlerts();
    expect(sent).toHaveLength(0);
  });

  it("respects the switch and forgets the phone at logout", async () => {
    const { ownerAuth, joinerAuth } = await family();
    await request(app).put("/notifications/push-token").set(ownerAuth).send({ token: "ExponentPushToken[owner]" });

    const off = await request(app).put("/notifications/family-alerts").set(ownerAuth).send({ enabled: false });
    expect(off.body.enabled).toBe(false);
    expect((await request(app).get("/notifications/family-alerts").set(ownerAuth)).body.enabled).toBe(false);
    await request(app).post("/tasks").set(joinerAuth).send(task);
    await flushFamilyAlerts();
    expect(sent).toHaveLength(0);

    await request(app).put("/notifications/family-alerts").set(ownerAuth).send({ enabled: true });
    await request(app).post("/auth/logout").send({ pushToken: "ExponentPushToken[owner]" });
    await request(app).post("/tasks").set(joinerAuth).send(task);
    await flushFamilyAlerts();
    expect(sent).toHaveLength(0);
  });

  it("rejects something that is not an Expo token", async () => {
    const { ownerAuth } = await family();
    expect((await request(app).put("/notifications/push-token").set(ownerAuth).send({ token: "abc" })).status).toBe(400);
  });
});
