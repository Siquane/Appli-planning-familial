import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { authHeader, signup } from "../helpers";

async function parentWithChild() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Édouard", level: "college", grade: "5e" });
  expect(created.status).toBe(201);
  const learner = await prisma.learner.findUniqueOrThrow({ where: { id: created.body.learner.id } });
  return { auth, learnerId: learner.id, familyId: learner.userId };
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
});
afterEach(() => {
  env.anthropicApiKey = "";
  vi.restoreAllMocks();
});

describe("Cervelle — cost of the AI", () => {
  it("prices a response from its tokens", () => {
    // Opus 5.5: $4 in, $20 out per million → micro-dollars = tokens × price.
    expect(ai.costMicros("claude-opus-5-5", { input_tokens: 1000, output_tokens: 500 })).toBe(14_000);
    // Cache reads cost a tenth, cache writes a quarter more.
    expect(ai.costMicros("claude-opus-5-5", { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 1000, cache_creation_input_tokens: 1000 })).toBe(400 + 5000);
    // An unknown model (a refusal fallback) is priced like the main one.
    expect(ai.costMicros("claude-new", { input_tokens: 1000, output_tokens: 0 })).toBe(4000);
  });

  it("adds up every response of one job, and nothing outside it", async () => {
    let saved: ai.Meter | null = null;
    await ai.metered(
      async (m) => {
        saved = m;
      },
      async () => {
        ai.meterResponse({ model: "claude-opus-5-5", usage: { input_tokens: 100, output_tokens: 10 } });
        await new Promise((r) => setTimeout(r, 5));
        ai.meterResponse({ model: "claude-opus-5-5", usage: { input_tokens: 200, output_tokens: 20 } });
      },
    );
    ai.meterResponse({ model: "claude-opus-5-5", usage: { input_tokens: 9999, output_tokens: 9999 } });
    expect(saved).toMatchObject({ input: 300, output: 30, micros: 300 * 4 + 30 * 20 });
  });

  it("stores the cost of a real call on the family's usage row", async () => {
    const { auth, learnerId } = await parentWithChild();
    vi.spyOn(ai, "assistantReply").mockImplementation(async () => {
      ai.meterResponse({ model: "claude-opus-5-5", usage: { input_tokens: 2000, output_tokens: 1000 } });
      return "Bonne question !";
    });
    const res = await request(app).post(`/cervelle/learners/${learnerId}/assistant`).set(auth).send({ messages: [{ role: "user", text: "Pourquoi le ciel est bleu ?" }] });
    expect(res.status).toBe(200);
    const row = await prisma.aiUsage.findFirstOrThrow({ where: { learnerId, kind: "assistant" } });
    expect(row).toMatchObject({ inputTokens: 2000, outputTokens: 1000, costMicros: 28_000, model: "claude-opus-5-5" });
  });

  it("shows the parent the month's cost per kind and per child", async () => {
    const { auth, learnerId, familyId } = await parentWithChild();
    await prisma.aiUsage.createMany({
      data: [
        { userId: familyId, learnerId, kind: "revision", costMicros: 250_000 },
        { userId: familyId, learnerId, kind: "revision", costMicros: 350_000 },
        { userId: familyId, learnerId, kind: "grading", costMicros: 0 }, // recorded before the meter
        { userId: familyId, learnerId, kind: "grading", costMicros: 20_000 },
      ],
    });
    const res = await request(app).get("/cervelle/usage").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeCloseTo(0.62);
    const revision = res.body.byKind.find((k: { kind: string }) => k.kind === "revision");
    expect(revision).toMatchObject({ calls: 2, measured: 2 });
    expect(revision.average).toBeCloseTo(0.3);
    const grading = res.body.byKind.find((k: { kind: string }) => k.kind === "grading");
    expect(grading).toMatchObject({ calls: 2, measured: 1 });
    expect(grading.average).toBeCloseTo(0.02);
    expect(res.body.byLearner).toEqual([{ id: learnerId, name: "Édouard", calls: 4, cost: 0.62 }]);
  });
});
