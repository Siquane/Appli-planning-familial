import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("meals", () => {
  it("upserts a slot, lists it and deletes it", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/meals").set(auth).send({ weekday: 1, type: "déjeuner", title: "Pâtes bolognaise" });
    expect(created.status).toBe(201);
    expect(created.body.meal).toMatchObject({ weekday: 1, type: "déjeuner", title: "Pâtes bolognaise", recipeId: null });
    const mealId = created.body.meal.id;

    const list = await request(app).get("/meals").set(auth);
    expect(list.status).toBe(200);
    expect(list.body.meals).toHaveLength(1);

    const deleted = await request(app).delete(`/meals/${mealId}`).set(auth);
    expect(deleted.status).toBe(204);

    const listAfter = await request(app).get("/meals").set(auth);
    expect(listAfter.body.meals).toHaveLength(0);
  });

  it("replaces the existing slot instead of duplicating it when posted again for the same weekday+type", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const first = await request(app).post("/meals").set(auth).send({ weekday: 2, type: "dîner", title: "Soupe" });
    const second = await request(app).post("/meals").set(auth).send({ weekday: 2, type: "dîner", title: "Gratin" });
    expect(second.body.meal.id).toBe(first.body.meal.id);
    expect(second.body.meal.title).toBe("Gratin");

    const list = await request(app).get("/meals").set(auth);
    expect(list.body.meals).toHaveLength(1);
  });

  it("links a meal to one of the user's own recipes", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const recipe = await request(app).post("/recipes").set(auth).send({ title: "Gratin de courgettes" });
    const meal = await request(app).post("/meals").set(auth).send({ weekday: 3, type: "déjeuner", recipeId: recipe.body.recipe.id });
    expect(meal.status).toBe(201);
    expect(meal.body.meal.recipeId).toBe(recipe.body.recipe.id);
  });

  it("rejects linking to another user's recipe", async () => {
    const userA = await signup(app, { email: "a@passerelle.test" });
    const userB = await signup(app, { email: "b@passerelle.test" });
    const recipe = await request(app).post("/recipes").set(authHeader(userA.accessToken)).send({ title: "Tarte" });

    const res = await request(app).post("/meals").set(authHeader(userB.accessToken)).send({ weekday: 0, type: "déjeuner", recipeId: recipe.body.recipe.id });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid meal type", async () => {
    const res = await request(app)
      .post("/meals")
      .set(authHeader((await signup(app)).accessToken))
      .send({ weekday: 0, type: "brunch" });
    expect(res.status).toBe(400);
  });

  it("isolates meals between users", async () => {
    const userA = await signup(app, { email: "a2@passerelle.test" });
    const userB = await signup(app, { email: "b2@passerelle.test" });
    await request(app).post("/meals").set(authHeader(userA.accessToken)).send({ weekday: 0, type: "déjeuner", title: "A" });

    const listAsB = await request(app).get("/meals").set(authHeader(userB.accessToken));
    expect(listAsB.body.meals).toHaveLength(0);
  });

  it("keeps a separate menu for each week", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app).post("/meals").set(auth).send({ week: "2026-11-23", weekday: 0, type: "dîner", title: "Gratin" });
    await request(app).post("/meals").set(auth).send({ week: "2026-11-30", weekday: 0, type: "dîner", title: "Curry" });
    const a = await request(app).get("/meals?week=2026-11-23").set(auth);
    const b = await request(app).get("/meals?week=2026-11-30").set(auth);
    expect(a.body.meals.map((m: { title: string }) => m.title)).toEqual(["Gratin"]);
    expect(b.body.meals.map((m: { title: string }) => m.title)).toEqual(["Curry"]);
    expect(b.body.meals[0].week).toBe("2026-11-30");
    expect((await request(app).post("/meals").set(auth).send({ week: "2026-11-25", weekday: 0, type: "dîner", title: "X" })).status).toBe(400);
  });
});
