import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { MAX_FILE_SIZE, setStorageForTests, type Storage } from "../../src/lib/storage";
import { authHeader, signup } from "../helpers";
import { prisma } from "../../src/db";

// In-memory stand-in for R2/S3: `objects` holds what the app would have PUT.
class FakeStorage implements Storage {
  objects = new Map<string, number>();
  async uploadUrl(key: string) {
    return `https://bucket.test/${key}?signature=put`;
  }
  async downloadUrl(key: string) {
    return `https://bucket.test/${key}?signature=get`;
  }
  async size(key: string) {
    return this.objects.get(key) ?? null;
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
  /** Simulates the app's direct PUT to the signed URL. */
  put(uploadUrl: string, size: number) {
    const key = decodeURIComponent(new URL(uploadUrl).pathname.slice(1));
    this.objects.set(key, size);
    return key;
  }
}

let storage: FakeStorage;
beforeEach(() => {
  storage = new FakeStorage();
  setStorageForTests(storage);
});
afterEach(() => setStorageForTests(undefined));

const pdf = { fileName: "ordonnance.pdf", mimeType: "application/pdf", size: 120_000 };

async function upload(auth: Record<string, string>, body: Record<string, unknown>, actualSize?: number) {
  const created = await request(app).post("/documents").set(auth).send(body);
  expect(created.status).toBe(201);
  storage.put(created.body.upload.url, actualSize ?? (body.size as number));
  const confirmed = await request(app).post(`/documents/${created.body.document.id}/confirm`).set(auth);
  return { created, confirmed };
}

describe("documents", () => {
  it("uploads a library document in two steps and lists it with a signed link", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/documents").set(auth).send({ ...pdf, category: "santé" });
    expect(created.status).toBe(201);
    expect(created.body.upload).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/pdf" } });
    expect(created.body.document).toMatchObject({ title: "ordonnance", category: "santé", url: null });

    // Not listed until confirmed.
    expect((await request(app).get("/documents").set(auth)).body.documents).toHaveLength(0);

    storage.put(created.body.upload.url, pdf.size);
    const confirmed = await request(app).post(`/documents/${created.body.document.id}/confirm`).set(auth);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.document.url).toMatch(/signature=get/);

    const list = await request(app).get("/documents").set(auth);
    expect(list.body.documents).toHaveLength(1);
    expect(list.body.documents[0]).toMatchObject({ title: "ordonnance", fileName: "ordonnance.pdf", recipeId: null });
  });

  it("refuses to confirm when the file never reached the bucket", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const created = await request(app).post("/documents").set(auth).send(pdf);
    const res = await request(app).post(`/documents/${created.body.document.id}/confirm`).set(auth);
    expect(res.status).toBe(400);
  });

  it("rejects files over 5 Mo, both announced and actually sent", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const announced = await request(app).post("/documents").set(auth).send({ ...pdf, size: MAX_FILE_SIZE + 1 });
    expect(announced.status).toBe(400);

    const { created, confirmed } = await upload(auth, pdf, MAX_FILE_SIZE + 1);
    expect(confirmed.status).toBe(400);
    expect(storage.objects.size).toBe(0);
    expect((await request(app).post(`/documents/${created.body.document.id}/confirm`).set(auth)).status).toBe(404);
  });

  it("rejects unsupported file types", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/documents").set(authHeader(accessToken)).send({ fileName: "virus.exe", mimeType: "application/x-msdownload", size: 10 });
    expect(res.status).toBe(400);
  });

  it("filters the library by category and member, and links a member", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const member = await request(app).post("/members").set(auth).send({ name: "Léa" });
    const memberId = member.body.member.id;

    await upload(auth, { ...pdf, category: "santé", memberId });
    await upload(auth, { ...pdf, fileName: "contrat.pdf", category: "assurance" });

    const sante = await request(app).get("/documents?category=santé").set(auth);
    expect(sante.body.documents).toHaveLength(1);
    expect(sante.body.documents[0].memberId).toBe(memberId);

    const lea = await request(app).get(`/documents?memberId=${memberId}`).set(auth);
    expect(lea.body.documents).toHaveLength(1);
  });

  it("keeps recipe attachments out of the library and removes their files with the recipe", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const recipe = await request(app).post("/recipes").set(auth).send({ title: "Tarte aux pommes" });
    const recipeId = recipe.body.recipe.id;

    await upload(auth, { fileName: "tarte.jpg", mimeType: "image/jpeg", size: 800_000, recipeId });

    expect((await request(app).get("/documents").set(auth)).body.documents).toHaveLength(0);
    const attachments = await request(app).get(`/documents?recipeId=${recipeId}`).set(auth);
    expect(attachments.body.documents).toHaveLength(1);
    expect(attachments.body.documents[0].mimeType).toBe("image/jpeg");
    expect(storage.objects.size).toBe(1);

    await request(app).delete(`/recipes/${recipeId}`).set(auth).expect(204);
    expect(storage.objects.size).toBe(0);
    expect((await request(app).get(`/documents?recipeId=${recipeId}`).set(auth)).body.documents).toHaveLength(0);
  });

  it("renames, re-classifies and deletes a document along with its file", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const { created } = await upload(auth, pdf);
    const id = created.body.document.id;

    const patched = await request(app).patch(`/documents/${id}`).set(auth).send({ title: "Ordonnance Léa", category: "santé" });
    expect(patched.status).toBe(200);
    expect(patched.body.document).toMatchObject({ title: "Ordonnance Léa", category: "santé" });

    await request(app).delete(`/documents/${id}`).set(auth).expect(204);
    expect(storage.objects.size).toBe(0);
    expect((await request(app).get("/documents").set(auth)).body.documents).toHaveLength(0);
  });

  it("does not let another family see, attach to, or delete documents", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });
    const authA = authHeader(userA.accessToken);
    const authB = authHeader(userB.accessToken);

    const { created } = await upload(authA, pdf);
    const recipe = await request(app).post("/recipes").set(authA).send({ title: "Gratin" });

    expect((await request(app).get("/documents").set(authB)).body.documents).toHaveLength(0);
    expect((await request(app).delete(`/documents/${created.body.document.id}`).set(authB)).status).toBe(404);
    expect((await request(app).patch(`/documents/${created.body.document.id}`).set(authB).send({ title: "x" })).status).toBe(404);
    expect((await request(app).post("/documents").set(authB).send({ ...pdf, recipeId: recipe.body.recipe.id })).status).toBe(400);
  });

  it("answers 503 when no storage is configured", async () => {
    setStorageForTests(null);
    const { accessToken } = await signup(app);
    const res = await request(app).post("/documents").set(authHeader(accessToken)).send(pdf);
    expect(res.status).toBe(503);
  });

  it("caps a free account at 20 documents and lifts the cap with either pack", async () => {
    const { accessToken, user } = await signup(app);
    const auth = authHeader(accessToken);
    await prisma.document.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({ userId: user.id, title: `d${i}`, category: "autre", fileKey: `k${i}`, fileName: "a.pdf", mimeType: "application/pdf", size: 1, status: "ready" })),
    });

    const refused = await request(app).post("/documents").set(auth).send({ ...pdf, category: "santé" });
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe("premium_required");

    await prisma.user.update({ where: { id: user.id }, data: { mealsUntil: new Date(Date.now() + 86_400_000) } });
    expect((await request(app).post("/documents").set(auth).send({ ...pdf, category: "santé" })).status).toBe(201);
  });
});
