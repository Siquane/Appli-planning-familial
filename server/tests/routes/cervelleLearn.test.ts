import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { mondayOf, parisDay } from "../../src/lib/cervelle/days";
import { authHeader, signup } from "../helpers";

async function parentWithChild(grade = "CE2") {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Jules", level: "primaire", grade });
  return { auth, learnerId: created.body.learner.id as string };
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
});
afterEach(() => {
  env.anthropicApiKey = "";
  vi.restoreAllMocks();
});

describe("Cervelle — dictée", () => {
  it("writes sentences from typed words, finds the words to review, pays stars once finished", async () => {
    vi.spyOn(ai, "writeDictation").mockResolvedValue({ words: ["château", "très"], sentences: ["Le château est très grand.", "Il est très vieux."] });
    const { auth, learnerId } = await parentWithChild();
    expect((await request(app).post(`/cervelle/learners/${learnerId}/dictations`).set(auth).send({ words: ["château"] })).status).toBe(400);
    const created = await request(app).post(`/cervelle/learners/${learnerId}/dictations`).set(auth).send({ words: ["château, très"] });
    expect(created.status).toBe(201);
    const id = created.body.dictation.id as string;
    expect(created.body.dictation.sentences).toHaveLength(2);

    const first = await request(app).post(`/cervelle/learners/${learnerId}/dictations/${id}/answer`).set(auth).send({ index: 0, typed: "Le chateau est très grand" });
    expect(first.body.dictation.sentences[0].missed).toEqual(["château"]);
    expect(first.body.stars).toBe(0);
    const second = await request(app).post(`/cervelle/learners/${learnerId}/dictations/${id}/answer`).set(auth).send({ index: 1, typed: "Il est très vieux." });
    expect(second.body.dictation).toMatchObject({ finished: true, toReview: ["château"] });
    expect(second.body.stars).toBe(2);
    // Corriger une phrase ne paie pas deux fois.
    const again = await request(app).post(`/cervelle/learners/${learnerId}/dictations/${id}/answer`).set(auth).send({ index: 0, typed: "Le château est très grand." });
    expect(again.body.stars).toBe(0);
    expect(again.body.dictation.toReview).toEqual([]);
  });
});

describe("Cervelle — carte mentale", () => {
  it("is drawn once by the AI, then kept; a branch has its own mini-quiz", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await prisma.revision.create({ data: { learnerId, title: "Les volcans", subject: "Sciences", status: "ready", sheets: [] } });
    const a = await prisma.notion.create({ data: { revisionId: revision.id, title: "Le magma" } });
    const b = await prisma.notion.create({ data: { revisionId: revision.id, title: "Les éruptions" } });
    for (const n of [a, b]) for (let i = 0; i < 4; i++) await prisma.question.create({ data: { revisionId: revision.id, notionId: n.id, type: "qcm", prompt: `${n.title} ${i}`, choices: ["x", "y"], answer: "0" } });
    const spy = vi.spyOn(ai, "makeMindMap").mockResolvedValue({ centre: "Les volcans", branches: [{ title: "Dedans", notionIds: [a.id], ideas: ["Roche fondue"] }] });
    const map = await request(app).get(`/cervelle/learners/${learnerId}/revisions/${revision.id}/mindmap`).set(auth);
    expect(map.status).toBe(200);
    expect(map.body.map.branches[0].title).toBe("Dedans");
    await request(app).get(`/cervelle/learners/${learnerId}/revisions/${revision.id}/mindmap`).set(auth);
    expect(spy).toHaveBeenCalledTimes(1);

    const quiz = await request(app).get(`/cervelle/learners/${learnerId}/quiz?mode=qcm&revisionId=${revision.id}&notionIds=${a.id}`).set(auth);
    expect(quiz.body.questions).toHaveLength(3);
    expect(quiz.body.questions.every((q: { notionId: string }) => q.notionId === a.id)).toBe(true);
  });
});

describe("Cervelle — calcul mental", () => {
  it("starts from the class, goes up after 3 good runs, keeps a record; a parent picks tables", async () => {
    const { auth, learnerId } = await parentWithChild("CE2");
    const state = (await request(app).get(`/cervelle/learners/${learnerId}/mental`).set(auth)).body;
    expect(state).toMatchObject({ level: 3, streak: 0, record: null });
    expect(state.problems).toHaveLength(10);
    const answers = state.problems.map((p: { prompt: string; answer: number }) => ({ ...p, typed: String(p.answer).replace(".", ",") }));

    let r = await request(app).post(`/cervelle/learners/${learnerId}/mental/runs`).set(auth).send({ level: 3, answers, seconds: 60 });
    expect(r.body).toMatchObject({ correct: 10, total: 10, leveledUp: false, newRecord: true, stars: 1 });
    r = await request(app).post(`/cervelle/learners/${learnerId}/mental/runs`).set(auth).send({ level: 3, answers, seconds: 70 });
    expect(r.body).toMatchObject({ newRecord: false, stars: 0 });
    r = await request(app).post(`/cervelle/learners/${learnerId}/mental/runs`).set(auth).send({ level: 3, answers, seconds: 50 });
    expect(r.body).toMatchObject({ leveledUp: true, newRecord: true });
    expect(r.body.state).toMatchObject({ level: 4, streak: 0, record: null });

    const set = await request(app).put(`/cervelle/learners/${learnerId}/mental`).set(auth).send({ tables: [7, 8, 7] });
    expect(set.body.tables).toEqual([7, 8]);
  });
});

describe("Cervelle — journal de fierté", () => {
  it("collects the week, is sent to the parents once and has a public page", async () => {
    const { auth, learnerId } = await parentWithChild();
    const today = parisDay();
    await prisma.journalEntry.create({ data: { learnerId, day: today, mood: 5, learned: "Les fractions", proud: "J'ai fini mon exposé <b>" } });
    const revision = await prisma.revision.create({ data: { learnerId, title: "R", status: "ready" } });
    await prisma.notion.create({ data: { revisionId: revision.id, title: "Le pluriel des noms", mastery: "mastered", masteredAt: new Date() } });

    const pride = (await request(app).get(`/cervelle/learners/${learnerId}/pride`).set(auth)).body.pride;
    expect(pride).toMatchObject({ week: mondayOf(today), notions: ["Le pluriel des noms"], sent: false });
    expect(pride.proud[0].text).toContain("exposé");

    const sent = await request(app).post(`/cervelle/learners/${learnerId}/pride`).set(auth).send({ message: "Je suis content !" });
    expect(sent.body).toMatchObject({ stars: 1, pride: { sent: true, message: "Je suis content !" } });
    expect((await request(app).post(`/cervelle/learners/${learnerId}/pride`).set(auth).send({ message: "Encore" })).body.stars).toBe(0);

    const page = await request(app).get(sent.body.pride.sharePath);
    expect(page.status).toBe(200);
    expect(page.text).toContain("Le journal de fierté de Jules");
    expect(page.text).toContain("Le pluriel des noms");
    expect(page.text).toContain("&lt;b&gt;");
    expect((await request(app).get("/f/nopenopenopenopenope")).status).toBe(404);

    await request(app).post(`/cervelle/learners/${learnerId}/pride/seen`).set(auth);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/pride`).set(auth)).body.pride.seen).toBe(true);
  });
});
