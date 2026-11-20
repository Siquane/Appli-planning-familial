import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { authHeader, signup } from "../helpers";

const paper: ai.GeneratedBrevet = {
  titre: "Sujet type — Histoire-géographie",
  duree_minutes: 120,
  exercices: [
    {
      titre: "Analyser des documents",
      points: 20,
      documents: "Extrait d'un discours de 1940.",
      questions: [{ enonce: "Présente le document.", points: 4, corrige: "C'est un discours du général de Gaulle…", conseil: "Nature, auteur, date, contexte." }],
    },
  ],
};

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout");
}

async function parentWithChild() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Inès", level: "college", grade: "3e" });
  return { auth, learnerId: created.body.learner.id as string };
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
});
afterEach(() => {
  env.anthropicApiKey = "";
  vi.restoreAllMocks();
});

describe("Cervelle — mode Brevet", () => {
  it("counts down to the exams and counts the child's revisions per subject", async () => {
    const { auth, learnerId } = await parentWithChild();
    await prisma.revision.createMany({
      data: [
        { learnerId, title: "La Seconde Guerre mondiale", subject: "Histoire", status: "ready" },
        { learnerId, title: "Théorème de Pythagore", subject: "Mathématiques", status: "ready" },
        { learnerId, title: "Brouillon", subject: "Histoire", status: "processing" },
      ],
    });
    const res = await request(app).get(`/cervelle/learners/${learnerId}/brevet`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2027-06-24");
    expect(res.body.daysLeft).toBeGreaterThanOrEqual(0);
    const count = (k: string) => res.body.subjects.find((s: { key: string }) => s.key === k).revisions;
    expect([count("histoire"), count("maths"), count("francais"), count("sciences")]).toEqual([1, 1, 0, 0]);
  });

  it("builds a paper from the child's revisions of that subject and the 3e programme", async () => {
    const { auth, learnerId } = await parentWithChild();
    await prisma.revision.createMany({
      data: [
        { learnerId, title: "La Seconde Guerre mondiale", subject: "Histoire", status: "ready", summary: "Guerre d'anéantissement." },
        { learnerId, title: "Pythagore", subject: "Maths", status: "ready" },
      ],
    });
    const gen = vi.spyOn(ai, "generateBrevet").mockResolvedValue(paper);
    const created = await request(app).post(`/cervelle/learners/${learnerId}/brevet/sujets`).set(auth).send({ subject: "histoire" });
    expect(created.status).toBe(202);
    expect(created.body.sujet.status).toBe("processing");
    const ready = await waitFor(
      () => request(app).get(`/cervelle/learners/${learnerId}/brevet/sujets/${created.body.sujet.id}`).set(auth),
      (r) => r.body.sujet.status !== "processing",
    );
    expect(ready.body.sujet).toMatchObject({ status: "ready", label: "Histoire-géographie-EMC", minutes: 120, title: "Sujet type — Histoire-géographie" });
    expect(ready.body.sujet.exercises[0].questions[0]).toEqual({ prompt: "Présente le document.", points: 4, correction: "C'est un discours du général de Gaulle…", advice: "Nature, auteur, date, contexte." });
    const args = gen.mock.calls[0][0];
    expect(args.courses).toContain("La Seconde Guerre mondiale");
    expect(args.courses).not.toContain("Pythagore");
    expect(args.programme.length).toBeGreaterThan(0);
  });

  it("marks a failed paper so the child can try again", async () => {
    const { auth, learnerId } = await parentWithChild();
    vi.spyOn(ai, "generateBrevet").mockRejectedValue(new ai.CervelleAiError("Le sujet n'a pas pu être préparé. Réessaie."));
    const created = await request(app).post(`/cervelle/learners/${learnerId}/brevet/sujets`).set(auth).send({ subject: "maths" });
    const done = await waitFor(
      () => request(app).get(`/cervelle/learners/${learnerId}/brevet/sujets/${created.body.sujet.id}`).set(auth),
      (r) => r.body.sujet.status !== "processing",
    );
    expect(done.body.sujet).toMatchObject({ status: "failed", error: "Le sujet n'a pas pu être préparé. Réessaie." });
  });

  it("refuses an unknown subject", async () => {
    const { auth, learnerId } = await parentWithChild();
    const res = await request(app).post(`/cervelle/learners/${learnerId}/brevet/sujets`).set(auth).send({ subject: "latin" });
    expect(res.status).toBe(400);
  });
});
