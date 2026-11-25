import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("Cervelle — routines du matin et du soir", () => {
  it("a parent sets the steps, the child ticks them, a finished routine gives 1 star once a day", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const learnerId = (await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire" })).body.learner.id as string;
    const url = `/cervelle/learners/${learnerId}/routines`;

    const empty = (await request(app).get(url).set(auth)).body;
    expect(empty.routines.map((r: { kind: string; steps: unknown[] }) => [r.kind, r.steps.length])).toEqual([["matin", 0], ["soir", 0]]);
    expect(empty.ideas.matin.length).toBeGreaterThan(3);

    const set = await request(app).put(`${url}/matin`).set(auth).send({ steps: [{ emoji: "🪥", label: "Dents" }, { emoji: "🎒", label: "Cartable" }] });
    expect(set.status).toBe(200);
    const steps = set.body.routines[0].steps as { id: string }[];
    expect(steps).toHaveLength(2);

    const tick = (stepId: string, on = true) => request(app).post(`${url}/matin/check`).set(auth).send({ stepId, on });
    const one = await tick(steps[0].id);
    expect(one.body).toMatchObject({ earned: 0 });
    expect(one.body.routines[0]).toMatchObject({ checked: [steps[0].id], done: false });
    const two = await tick(steps[1].id);
    expect(two.body).toMatchObject({ earned: 1 });
    expect(two.body.routines[0]).toMatchObject({ done: true, rewarded: true });
    // Untick and tick again: no second star.
    await tick(steps[1].id, false);
    expect((await tick(steps[1].id)).body.earned).toBe(0);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/stars`).set(auth)).body.breakdown.missions).toBe(1);

    expect((await tick("inconnu")).status).toBe(404);
    expect((await request(app).put(`${url}/midi`).set(auth).send({ steps: [] })).status).toBe(404);
  });
});
