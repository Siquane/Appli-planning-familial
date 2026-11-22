import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import { setStorageForTests, type Storage } from "../../src/lib/storage";
import * as ai from "../../src/services/cervelleAi";
import { authHeader, signup } from "../helpers";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");
const page = { data: JPEG, mimeType: "image/jpeg" };

/** In-memory stand-in for the bucket, with server-side reads and writes. */
class FakeStorage implements Storage {
  objects = new Map<string, Buffer>();
  async uploadUrl(key: string) {
    return `https://bucket.test/${key}`;
  }
  async downloadUrl(key: string) {
    return `https://bucket.test/${key}`;
  }
  async size(key: string) {
    return this.objects.get(key)?.length ?? null;
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
  async putObject(key: string, body: Buffer) {
    this.objects.set(key, body);
  }
  async getObject(key: string) {
    return this.objects.get(key) ?? null;
  }
}

const sub = (titre: string) => ({
  titre,
  origine: "cours" as const,
  fiche: { essentiel: `${titre}.`, points: [], vocabulaire: [], exemple: "", retenir: "" },
  questions: [{ type: "vrai_faux" as const, enonce: `${titre} ?`, choix: [], reponse: "vrai", reponses_acceptees: [], elements: [], explication: "" }],
});
const generated = (subs: string[]): ai.GeneratedRevision => ({
  lisible: true,
  probleme: "",
  titre: "Le système solaire",
  matiere: "Sciences",
  icone: "planete",
  resume: "Les planètes.",
  chapitre_programme: "",
  notions: [{ titre: "Les planètes", sous_notions: subs.map(sub) }],
});

async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const v = await fn();
    if (ok(v)) return v;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout");
}

let storage: FakeStorage;
beforeEach(() => {
  env.anthropicApiKey = "test-key";
  storage = new FakeStorage();
  setStorageForTests(storage);
});
afterEach(() => {
  env.anthropicApiKey = "";
  setStorageForTests(undefined);
  vi.restoreAllMocks();
});

async function readyRevision() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const learner = await request(app).post("/cervelle/learners").set(auth).send({ name: "Léa", level: "college", grade: "5e" });
  const learnerId = learner.body.learner.id as string;
  vi.spyOn(ai, "generateRevision").mockResolvedValueOnce(generated(["Planètes telluriques"]));
  const created = await request(app).post(`/cervelle/learners/${learnerId}/revisions`).set(auth).send({ files: [page] });
  const id = created.body.revision.id as string;
  const get = () => request(app).get(`/cervelle/learners/${learnerId}/revisions/${id}`).set(auth);
  await waitFor(get, (r) => r.body.revision.status === "ready");
  return { auth, learnerId, id, get };
}

describe("Cervelle — ajouter des pages à un cours", () => {
  it("prepares the revision again with every page and keeps what was learned", async () => {
    const { auth, learnerId, id, get } = await readyRevision();
    // Léa has worked: a notion mastered and an answer on record.
    const leaf = await prisma.notion.findFirstOrThrow({ where: { revisionId: id, parentId: { not: null } } });
    await prisma.notion.update({ where: { id: leaf.id }, data: { mastery: "mastered", streak: 3 } });
    const question = await prisma.question.findFirstOrThrow({ where: { revisionId: id } });
    await prisma.attempt.create({ data: { learnerId, questionId: question.id, correct: true, mode: "qcm" } });

    const gen = vi.spyOn(ai, "generateRevision").mockResolvedValueOnce(generated(["Planètes TELLURIQUES", "Planètes gazeuses"]));
    const res = await request(app).post(`/cervelle/learners/${learnerId}/revisions/${id}/pages`).set(auth).send({ files: [page] });
    expect(res.status).toBe(202);
    const done = await waitFor(get, (r) => r.body.revision.status === "ready");

    expect(gen.mock.lastCall![0].files).toHaveLength(2);
    expect(done.body.revision.sheets.map((s: { title: string }) => s.title)).toEqual(["Planètes TELLURIQUES", "Planètes gazeuses"]);
    const leaves = await prisma.notion.findMany({ where: { revisionId: id, parentId: { not: null } }, orderBy: { order: "asc" } });
    expect(leaves.map((n) => [n.mastery, n.streak])).toEqual([["mastered", 3], ["new", 0]]);
    expect((await prisma.revision.findUniqueOrThrow({ where: { id } })).photoKeys).toHaveLength(2);
    expect(storage.objects.size).toBe(2);
    // The answer still counts (for badges), without its old question.
    const attempts = await prisma.attempt.findMany({ where: { learnerId } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].questionId).toBeNull();
  });

  it("goes back to the previous fiches when the new preparation fails", async () => {
    const { auth, learnerId, id, get } = await readyRevision();
    vi.spyOn(ai, "generateRevision").mockRejectedValueOnce(new ai.CervelleAiError("Photo trop floue."));
    await request(app).post(`/cervelle/learners/${learnerId}/revisions/${id}/pages`).set(auth).send({ files: [page] });
    const done = await waitFor(get, (r) => r.body.revision.status !== "processing");
    expect(done.body.revision.status).toBe("ready");
    expect(done.body.revision.error).toBe("Les nouvelles pages n'ont pas pu être ajoutées : Photo trop floue.");
    expect(done.body.revision.sheets).toHaveLength(1);
    expect((await prisma.revision.findUniqueOrThrow({ where: { id } })).photoKeys).toHaveLength(1);
    expect(storage.objects.size).toBe(1);
  });

  it("refuses too many pages, a revision not ready, or one whose photos are gone", async () => {
    const { auth, learnerId, id } = await readyRevision();
    const many = await request(app).post(`/cervelle/learners/${learnerId}/revisions/${id}/pages`).set(auth).send({ files: Array(8).fill(page) });
    expect(many.status).toBe(400);
    expect(many.body.error).toContain("déjà 1");

    await prisma.revision.update({ where: { id }, data: { status: "processing" } });
    expect((await request(app).post(`/cervelle/learners/${learnerId}/revisions/${id}/pages`).set(auth).send({ files: [page] })).status).toBe(409);

    await prisma.revision.update({ where: { id }, data: { status: "ready" } });
    storage.objects.clear();
    const gone = await request(app).post(`/cervelle/learners/${learnerId}/revisions/${id}/pages`).set(auth).send({ files: [page] });
    expect(gone.status).toBe(410);
  });
});
