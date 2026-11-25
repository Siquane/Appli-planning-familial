import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { authHeader, signup } from "../helpers";

describe("Cervelle — carte au trésor (route)", () => {
  it("reveals spots with mastered notions and pays a complete island once", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/islands`;

    const empty = (await request(app).get(url).set(auth)).body;
    expect(empty.islands.map((i: { id: string }) => i.id)).toEqual(["maths", "francais", "histoire", "sciences", "langues", "talents"]);
    expect(empty).toMatchObject({ completeCount: 0, fresh: [] });

    const revision = await prisma.revision.create({ data: { learnerId, title: "Les fractions", subject: "Mathématiques", status: "ready" } });
    // A parent notion (not counted) and 12 leaves mastered, plus one never mastered.
    const parent = await prisma.notion.create({ data: { revisionId: revision.id, title: "Fractions", mastery: "mastered", masteredAt: new Date() } });
    await prisma.notion.createMany({ data: Array.from({ length: 12 }, (_, i) => ({ revisionId: revision.id, parentId: parent.id, title: `Notion ${i + 1}`, mastery: "mastered", masteredAt: new Date(Date.now() - (12 - i) * 1000) })) });
    await prisma.notion.create({ data: { revisionId: revision.id, parentId: parent.id, title: "Pas encore", mastery: "new" } });

    const before = (await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } })).coins;
    const r = (await request(app).get(url).set(auth)).body;
    const maths = r.islands.find((i: { id: string }) => i.id === "maths");
    expect(maths).toMatchObject({ explored: 12, complete: true, mastered: 12 });
    expect(maths.found[0]).toEqual({ title: "Notion 1", revisionTitle: "Les fractions" });
    expect(r.fresh.map((f: { kind: string }) => f.kind)).toEqual(["coffre", "chapeau"]);
    const chest = r.fresh[0];
    expect(chest.coins).toBeGreaterThanOrEqual(50);
    const after = await prisma.learner.findUniqueOrThrow({ where: { id: learnerId } });
    expect(after.coins).toBe(before + chest.coins);
    expect(after.owned).toContain("chapeau_pirate");
    expect(after.equipped).toContain("chapeau_pirate");

    // Asked again: nothing more.
    expect((await request(app).get(url).set(auth)).body.fresh).toEqual([]);

    // The island badge.
    const badges = (await request(app).get(`/cervelle/learners/${learnerId}/badges`).set(auth)).body;
    expect(badges.windows[0]).toMatchObject({ key: "ile:maths", family: "ile", label: "Explorateur : Île des Nombres", earned: true });
  });
});
