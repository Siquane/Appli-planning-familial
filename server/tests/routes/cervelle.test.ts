import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { authHeader, signup } from "../helpers";

// A tiny valid JPEG header: the route checks the magic bytes, Claude is mocked.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");

const generated: ai.GeneratedRevision = {
  lisible: true,
  probleme: "",
  titre: "Le système solaire",
  matiere: "Sciences",
  icone: "planete",
  resume: "Le Soleil et les planètes qui tournent autour.",
  chapitre_programme: "",
  notions: [
    {
      titre: "Les planètes",
      sous_notions: [
        {
          titre: "Planètes telluriques",
          origine: "cours",
          fiche: { essentiel: "Quatre planètes rocheuses.", points: ["Mercure, Vénus, Terre, Mars"], vocabulaire: [{ terme: "tellurique", definition: "rocheuse" }], exemple: "", retenir: "4 telluriques" },
          questions: [
            { type: "qcm", enonce: "Laquelle est tellurique ?", choix: ["Jupiter", "Mars", "Saturne"], reponse: "1", reponses_acceptees: [], elements: [], explication: "Mars est rocheuse." },
            { type: "vrai_faux", enonce: "La Terre est tellurique.", choix: [], reponse: "vrai", reponses_acceptees: [], elements: [], explication: "" },
            { type: "courte", enonce: "Planète la plus proche du Soleil ?", choix: [], reponse: "Mercure", reponses_acceptees: [], elements: [], explication: "" },
            // Unplayable: the answer index is out of range — dropped.
            { type: "qcm", enonce: "Cassée", choix: ["a", "b"], reponse: "5", reponses_acceptees: [], elements: [], explication: "" },
          ],
        },
        {
          titre: "Planètes gazeuses",
          origine: "cours",
          fiche: { essentiel: "Quatre géantes gazeuses.", points: [], vocabulaire: [], exemple: "", retenir: "" },
          questions: [
            { type: "ordre", enonce: "Range de la plus proche à la plus lointaine", choix: [], reponse: "", reponses_acceptees: [], elements: ["Jupiter", "Saturne", "Uranus", "Neptune"], explication: "" },
            { type: "carte", enonce: "Plus grosse planète ?", choix: [], reponse: "Jupiter", reponses_acceptees: [], elements: [], explication: "" },
            { type: "trous", enonce: "Saturne a des ___.", choix: [], reponse: "anneaux", reponses_acceptees: [], elements: [], explication: "" },
          ],
        },
      ],
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
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Édouard", level: "college", grade: "5e" });
  expect(created.status).toBe(201);
  return { auth, learnerId: created.body.learner.id as string };
}

async function readyRevision(auth: Record<string, string>, learnerId: string) {
  vi.spyOn(ai, "generateRevision").mockResolvedValue(generated);
  const res = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }], examDate: "2099-01-10" });
  expect(res.status).toBe(202);
  const id = res.body.revision.id as string;
  const detail = await waitFor(
    () => request(app).get(`/cervelle/learners/${learnerId}/revisions/${id}`).set(auth),
    (r) => r.body.revision?.status !== "processing",
  );
  expect(detail.body.revision.status).toBe("ready");
  return detail.body.revision;
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
});
afterEach(() => {
  vi.restoreAllMocks();
  env.anthropicApiKey = "";
});

describe("Cervelle — profiles and child sign-in", () => {
  it("lets a parent create a child, and the child sign in with a one-time code", async () => {
    const { auth, learnerId } = await parentWithChild();
    const code = await request(app).post(`/cervelle/learners/${learnerId}/code`).set(auth);
    expect(code.status).toBe(201);
    expect(code.body.code).toMatch(/^\d{6}$/);

    const login = await request(app).post("/cervelle/child/login").send({ code: code.body.code, deviceName: "Téléphone d'Édouard" });
    expect(login.status).toBe(201);
    expect(login.body.learner.name).toBe("Édouard");
    const child = { Authorization: `Bearer ${login.body.token}` };

    // The code is single use.
    expect((await request(app).post("/cervelle/child/login").send({ code: code.body.code })).status).toBe(401);

    const session = await request(app).get("/cervelle/session").set(child);
    expect(session.body).toMatchObject({ kind: "child", learner: { id: learnerId } });
    expect((await request(app).get("/cervelle/learners/me/home").set(child)).status).toBe(200);
    // A child can't list or manage profiles.
    expect((await request(app).get("/cervelle/learners").set(child)).status).toBe(403);
    expect((await request(app).post(`/cervelle/learners/${learnerId}/code`).set(child)).status).toBe(403);

    // The parent unlinks the phone: its token stops working.
    const devices = await request(app).get(`/cervelle/learners/${learnerId}/devices`).set(auth);
    expect(devices.body.devices).toHaveLength(1);
    await request(app).delete(`/cervelle/learners/${learnerId}/devices/${devices.body.devices[0].id}`).set(auth);
    const after = await request(app).get("/cervelle/learners/me/home").set(child);
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("device_revoked");
  });

  it("keeps each family's children private", async () => {
    const { learnerId } = await parentWithChild();
    const other = authHeader((await signup(app)).accessToken);
    expect((await request(app).get(`/cervelle/learners/${learnerId}/home`).set(other)).status).toBe(404);
    expect((await request(app).get("/cervelle/learners").set(other)).body.learners).toEqual([]);
  });

  it("refuses an unknown code", async () => {
    expect((await request(app).post("/cervelle/child/login").send({ code: "123456" })).status).toBe(401);
    expect((await request(app).post("/cervelle/child/login").send({ code: "12" })).status).toBe(400);
  });
});

describe("Cervelle — revisions", () => {
  it("prepares a revision from photos: notions, sheets and playable questions", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    expect(revision).toMatchObject({ title: "Le système solaire", subject: "Sciences", icon: "planete", examDate: "2099-01-10", photoCount: 1, questionCount: 6 });
    expect(revision.notions).toHaveLength(1);
    expect(revision.notions[0].children.map((c: { title: string }) => c.title)).toEqual(["Planètes telluriques", "Planètes gazeuses"]);
    expect(revision.notions[0].mastery).toBe("new");
    expect(revision.sheets).toHaveLength(2);
    expect(revision.sheets[0]).toMatchObject({ title: "Planètes telluriques", vocabulaire: [{ terme: "tellurique", definition: "rocheuse" }] });

    // The generator only saw the child's level, never the name.
    const call = vi.mocked(ai.generateRevision).mock.calls[0][0];
    expect(call.level).toBe("college");
    expect(JSON.stringify({ ...call, files: [] })).not.toContain("Édouard");

    const home = await request(app).get(`/cervelle/learners/${learnerId}/home`).set(auth);
    expect(home.body.revisions[0]).toMatchObject({ id: revision.id, status: "ready", progress: 0 });
  });

  it("stores Claude's refusal to read the photos as a failed revision", async () => {
    const { auth, learnerId } = await parentWithChild();
    vi.spyOn(ai, "generateRevision").mockRejectedValue(new ai.CervelleAiError("Photo trop floue."));
    const res = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    const detail = await waitFor(
      () => request(app).get(`/cervelle/learners/${learnerId}/revisions/${res.body.revision.id}`).set(auth),
      (r) => r.body.revision.status !== "processing",
    );
    expect(detail.body.revision).toMatchObject({ status: "failed", error: "Photo trop floue." });
  });

  it("rejects files that are not images or PDF, and answers 503 without a Claude key", async () => {
    const { auth, learnerId } = await parentWithChild();
    const bad = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [{ data: Buffer.from("hello world, not a jpeg").toString("base64"), mimeType: "image/jpeg" }] });
    expect(bad.status).toBe(400);
    env.anthropicApiKey = "";
    const off = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    expect(off.status).toBe(503);
  });
});

describe("Cervelle — quiz, mastery and game", () => {
  it("never sends the answers, grades them, and moves the notion labels", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    const quiz = await request(app).get(`/cervelle/learners/${learnerId}/quiz?revisionId=${revision.id}&mode=qcm`).set(auth);
    expect(quiz.status).toBe(200);
    expect(quiz.body.questions.map((q: { type: string }) => q.type).sort()).toEqual(["qcm", "vrai_faux"]);
    for (const q of quiz.body.questions) expect(q).not.toHaveProperty("answer");

    const qcm = quiz.body.questions.find((q: { type: string }) => q.type === "qcm");
    const wrong = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: qcm.id, mode: "qcm", answer: "0" });
    expect(wrong.body).toMatchObject({ correct: false, expected: "Mars", explanation: "Mars est rocheuse.", mastery: "review", coins: 0 });

    const right = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: qcm.id, mode: "qcm", answer: "1" });
    expect(right.body).toMatchObject({ correct: true, coins: 2 });
    // The same question right again the same day earns no more coins.
    const again = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: qcm.id, mode: "qcm", answer: "1" });
    expect(again.body.coins).toBe(0);

    const cards = await request(app).get(`/cervelle/learners/${learnerId}/quiz?revisionId=${revision.id}&mode=cartes`).set(auth);
    const backs = Object.fromEntries(cards.body.questions.map((q: { type: string; back: string }) => [q.type, q.back]));
    expect(backs).toEqual({ carte: "Jupiter", courte: "Mercure", trous: "Saturne a des anneaux." });

    const review = await request(app).get(`/cervelle/learners/${learnerId}/quiz?mode=a_revoir`).set(auth);
    expect(review.body.questions.length).toBeGreaterThan(0);
  });

  it("checks typed answers locally first, then asks Claude", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    const questions = await prisma.question.findMany({ where: { revisionId: revision.id } });
    const courte = questions.find((q) => q.type === "courte")!;
    const grade = vi.spyOn(ai, "gradeAnswer").mockResolvedValue({ correct: true, comment: "Oui, c'est Mercure." });

    const local = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: courte.id, mode: "interro", answer: "mercure" });
    expect(local.body.correct).toBe(true);
    expect(grade).not.toHaveBeenCalled();

    const viaClaude = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: courte.id, mode: "interro", answer: "la première planète, Mercure" });
    expect(viaClaude.body).toMatchObject({ correct: true, comment: "Oui, c'est Mercure." });
    expect(grade).toHaveBeenCalledTimes(1);

    const ordre = questions.find((q) => q.type === "ordre")!;
    const good = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: ordre.id, mode: "interro", answer: ["Jupiter", "Saturne", "Uranus", "Neptune"] });
    expect(good.body.correct).toBe(true);
    const bad = await request(app).post(`/cervelle/learners/${learnerId}/answers`).set(auth).send({ questionId: ordre.id, mode: "interro", answer: ["Saturne", "Jupiter", "Uranus", "Neptune"] });
    expect(bad.body).toMatchObject({ correct: false, expected: "Jupiter → Saturne → Uranus → Neptune" });
  });

  it("records sessions: streak, best scores, coins, missions and the chest", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    const url = `/cervelle/learners/${learnerId}`;

    const read = await request(app).post(`${url}/sessions`).set(auth).send({ revisionId: revision.id, mode: "fiches", seconds: 120 });
    expect(read.status).toBe(201);
    expect(read.body.learner.streak).toBe(1);
    expect(read.body.streakIncreased).toBe(true);
    expect(read.body.session.coins).toBe(3);

    const quiz = await request(app).post(`${url}/sessions`).set(auth).send({ revisionId: revision.id, mode: "interro", seconds: 300, correct: 9, total: 10 });
    expect(quiz.body.session).toMatchObject({ percent: 90, score20: 18, coins: 15 });
    expect(quiz.body.missions.done).toBe(2);

    // Missions not finished: the chest stays closed.
    expect((await request(app).post(`${url}/chest`).set(auth)).status).toBe(400);
    const questions = await prisma.question.findMany({ where: { revisionId: revision.id }, take: 1 });
    await prisma.attempt.createMany({ data: Array.from({ length: 15 }, () => ({ learnerId, questionId: questions[0].id, correct: true, mode: "qcm" })) });
    const chest = await request(app).post(`${url}/chest`).set(auth);
    expect(chest.status).toBe(200);
    expect(chest.body.coins).toBe(20);
    expect((await request(app).post(`${url}/chest`).set(auth)).status).toBe(409);

    const detail = await request(app).get(`${url}/revisions/${revision.id}`).set(auth);
    expect(detail.body.revision.steps).toMatchObject({ sheets: true, quizBest: null, examBest: 90 });

    const overview = await request(app).get(`${url}/overview`).set(auth);
    expect(overview.body.time).toMatchObject({ last30Seconds: 420, totalSeconds: 420, changePercent: 100 });
    expect(overview.body.upcoming.map((r: { id: string }) => r.id)).toEqual([revision.id]);
  });

  it("sells accessories only for coins the child has", async () => {
    const { auth, learnerId } = await parentWithChild();
    const url = `/cervelle/learners/${learnerId}`;
    expect((await request(app).post(`${url}/shop/casquette/buy`).set(auth)).status).toBe(400);
    await prisma.learner.update({ where: { id: learnerId }, data: { coins: 100 } });
    const bought = await request(app).post(`${url}/shop/casquette/buy`).set(auth);
    expect(bought.body.learner).toMatchObject({ coins: 70, owned: ["casquette"], equipped: ["casquette"] });
    await request(app).post(`${url}/shop/toque/buy`).set(auth);
    const shop = await request(app).get(`${url}/shop`).set(auth);
    // Same slot (head): the toque replaced the cap.
    expect(shop.body.items.find((i: { id: string }) => i.id === "casquette")).toMatchObject({ owned: true, equipped: false });
    expect(shop.body.coins).toBe(0);
  });
});

describe("Cervelle — assistant and corrected tests", () => {
  it("answers with the course as context", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    const spy = vi.spyOn(ai, "assistantReply").mockResolvedValue("Une planète tellurique est rocheuse.");
    const res = await request(app).post(`/cervelle/learners/${learnerId}/assistant`).set(auth).send({ revisionId: revision.id, messages: [{ role: "user", text: "C'est quoi tellurique ?" }] });
    expect(res.body.reply).toBe("Une planète tellurique est rocheuse.");
    expect(spy.mock.calls[0][0].course).toContain("Planètes telluriques");
  });

  it("analyses a corrected test and sends the missed notions back to « À revoir »", async () => {
    const { auth, learnerId } = await parentWithChild();
    const revision = await readyRevision(auth, learnerId);
    const leaf = revision.notions[0].children[1];
    vi.spyOn(ai, "analyzeExam").mockImplementation(async ({ notions }) => {
      expect(notions.map((n) => n.id)).toContain(leaf.id);
      return {
        note: "14/20",
        resume: "Bon travail.",
        points_forts: ["Les telluriques"],
        erreurs: [{ question: "Ex. 2", reponse_eleve: "Mars", correction: "Jupiter", explication: "La plus grosse est Jupiter.", notion_id: leaf.id }],
        conseils: ["Relis la fiche des gazeuses"],
      };
    });
    const res = await request(app).post(`/cervelle/learners/${learnerId}/exam-reviews`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }], revisionId: revision.id });
    expect(res.status).toBe(202);
    const done = await waitFor(
      () => request(app).get(`/cervelle/learners/${learnerId}/exam-reviews/${res.body.examReview.id}`).set(auth),
      (r) => r.body.examReview.status !== "processing",
    );
    expect(done.body.examReview).toMatchObject({ status: "ready", revisionTitle: "Le système solaire", analysis: { note: "14/20" } });
    const detail = await request(app).get(`/cervelle/learners/${learnerId}/revisions/${revision.id}`).set(auth);
    expect(detail.body.revision.notions[0].children[1].mastery).toBe("review");
    expect(detail.body.revision.notions[0].mastery).toBe("review");
  });
});

describe("Cervelle — programme officiel", () => {
  const withProgramme: ai.GeneratedRevision = {
    ...generated,
    titre: "Chrétientés et islam",
    matiere: "",
    chapitre_programme: "5e-hi-chretientes-islam",
    notions: [
      {
        titre: "Byzance",
        sous_notions: [
          { ...generated.notions[0].sous_notions[0], titre: "L'Empire byzantin", origine: "cours" },
          { ...generated.notions[0].sous_notions[1], titre: "L'Europe carolingienne", origine: "programme" },
          { ...generated.notions[0].sous_notions[1], titre: "En trop 1", origine: "programme" },
          { ...generated.notions[0].sous_notions[1], titre: "En trop 2", origine: "programme" },
        ],
      },
    ],
  };

  it("gives Claude the chapters of the class, stores the chapter and marks what the programme added", async () => {
    const { auth, learnerId } = await parentWithChild();
    const spy = vi.spyOn(ai, "generateRevision").mockResolvedValue(withProgramme);
    const res = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    const detail = await waitFor(
      () => request(app).get(`/cervelle/learners/${learnerId}/revisions/${res.body.revision.id}`).set(auth),
      (r) => r.body.revision.status !== "processing",
    );
    expect(spy.mock.calls[0][0].programme).toContain("[5e-hi-feodal]");
    const r = detail.body.revision;
    expect(r.programme).toEqual({ chapterId: "5e-hi-chretientes-islam", chapter: "Chrétientés et islam (VIe-XIIIe siècles), des mondes en contact", subject: "Histoire", grade: "5e" });
    expect(r.subject).toBe("Histoire");
    // At most 2 additions from the programme; the course stays the base.
    expect(r.notions[0].children.map((c: { title: string; fromProgramme: boolean }) => [c.title, c.fromProgramme])).toEqual([
      ["L'Empire byzantin", false],
      ["L'Europe carolingienne", true],
      ["En trop 1", true],
    ]);

    const programme = await request(app).get(`/cervelle/learners/${learnerId}/programme`).set(auth);
    expect(programme.body).toMatchObject({ available: true, grade: "5e" });
    const histoire = programme.body.subjects.find((s: { subject: string }) => s.subject === "Histoire");
    const chapter = histoire.chapters.find((c: { id: string }) => c.id === "5e-hi-chretientes-islam");
    expect(chapter).toMatchObject({ status: "started", revisions: [{ id: r.id }] });
    expect(histoire.chapters.find((c: { id: string }) => c.id === "5e-hi-feodal").status).toBe("todo");
  });

  it("keeps adults to their course: no programme, nothing added", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const adult = await request(app).post("/cervelle/learners").set(auth).send({ name: "Sam", level: "adulte", grade: "5e" });
    const spy = vi.spyOn(ai, "generateRevision").mockResolvedValue(withProgramme);
    const res = await request(app).post(`/cervelle/learners/${adult.body.learner.id}/revisions`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    const detail = await waitFor(
      () => request(app).get(`/cervelle/learners/${adult.body.learner.id}/revisions/${res.body.revision.id}`).set(auth),
      (r) => r.body.revision.status !== "processing",
    );
    expect(spy.mock.calls[0][0].programme).toBeNull();
    expect(detail.body.revision.programme).toBeNull();
    expect(detail.body.revision.notions[0].children).toHaveLength(1);
    expect((await request(app).get(`/cervelle/learners/${adult.body.learner.id}/programme`).set(auth)).body.available).toBe(false);
  });
});
