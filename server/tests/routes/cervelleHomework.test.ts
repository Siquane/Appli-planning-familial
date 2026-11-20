import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import { prisma } from "../../src/db";
import * as ai from "../../src/services/cervelleAi";
import { authHeader, signup } from "../helpers";

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]).toString("base64");
const SECRET = "x = 7 car 3 × 7 = 21";

async function parentWithChild() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/cervelle/learners").set(auth).send({ name: "Édouard", level: "college", grade: "5e" });
  return { auth, learnerId: created.body.learner.id as string };
}

beforeEach(() => {
  env.anthropicApiKey = "test-key";
  vi.spyOn(ai, "readHomework").mockResolvedValue({
    lisible: true,
    probleme: "",
    matiere: "Maths",
    consigne: "Résous les équations.",
    questions: [
      { enonce: "3x = 21", indices: ["Que fait-on pour isoler x ?", "Divise les deux côtés par le même nombre.", "21 divisé par 3…"], solution: SECRET },
      { enonce: "x + 4 = 10", indices: ["a", "b", "c"], solution: "x = 6" },
    ],
  });
});
afterEach(() => {
  env.anthropicApiKey = "";
  vi.restoreAllMocks();
});

describe("Cervelle — aide aux devoirs", () => {
  it("reads an exercise and reveals hints one at a time, never the solution", async () => {
    const { auth, learnerId } = await parentWithChild();
    const created = await request(app).post(`/cervelle/learners/${learnerId}/homework`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    expect(created.status).toBe(201);
    const hw = created.body.homework;
    expect(hw).toMatchObject({ subject: "Maths", instructions: "Résous les équations.", solved: 0 });
    expect(hw.questions[0]).toMatchObject({ prompt: "3x = 21", hints: [], hintsLeft: 3, solved: false });
    expect(JSON.stringify(created.body)).not.toContain(SECRET);

    for (const n of [1, 2, 3, 3]) {
      const hint = await request(app).post(`/cervelle/learners/${learnerId}/homework/${hw.id}/hint`).set(auth).send({ index: 0 });
      expect(hint.body.homework.questions[0].hints).toHaveLength(n);
      expect(JSON.stringify(hint.body)).not.toContain(SECRET);
    }
    const list = await request(app).get(`/cervelle/learners/${learnerId}/homework`).set(auth);
    expect(list.body.homework).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(SECRET);
  });

  it("checks the child's answer with the hidden solution, and counts tries", async () => {
    const { auth, learnerId } = await parentWithChild();
    const created = await request(app).post(`/cervelle/learners/${learnerId}/homework`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    const id = created.body.homework.id;
    const check = vi.spyOn(ai, "checkHomework").mockResolvedValueOnce({ correct: false, message: "Revois la division." }).mockResolvedValueOnce({ correct: true, message: "Bravo, tu as trouvé tout seul !" });

    const wrong = await request(app).post(`/cervelle/learners/${learnerId}/homework/${id}/check`).set(auth).send({ index: 0, answer: "x = 18" });
    expect(wrong.body).toMatchObject({ correct: false, message: "Revois la division." });
    expect(check.mock.calls[0][0]).toMatchObject({ question: "3x = 21", solution: SECRET, answer: "x = 18" });

    const right = await request(app).post(`/cervelle/learners/${learnerId}/homework/${id}/check`).set(auth).send({ index: 0, answer: "7" });
    expect(right.body.homework.questions[0]).toMatchObject({ solved: true, attempts: 2, lastMessage: "Bravo, tu as trouvé tout seul !" });
    expect(right.body.homework.solved).toBe(1);
    expect(JSON.stringify(right.body)).not.toContain(SECRET);

    const usage = await prisma.aiUsage.count({ where: { learnerId, kind: "homework" } });
    expect(usage).toBe(3); // one reading, two checks
  });

  it("says when the photo is not an exercise", async () => {
    const { auth, learnerId } = await parentWithChild();
    vi.spyOn(ai, "readHomework").mockRejectedValue(new ai.CervelleAiError("Je ne vois pas d'exercice sur cette photo."));
    const res = await request(app).post(`/cervelle/learners/${learnerId}/homework`).set(auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("exercice");
  });

  it("keeps one family out of another's homework", async () => {
    const a = await parentWithChild();
    const b = await parentWithChild();
    const created = await request(app).post(`/cervelle/learners/${a.learnerId}/homework`).set(a.auth).send({ files: [{ data: JPEG, mimeType: "image/jpeg" }] });
    const res = await request(app).get(`/cervelle/learners/${a.learnerId}/homework/${created.body.homework.id}`).set(b.auth);
    expect(res.status).toBe(404);
  });
});
