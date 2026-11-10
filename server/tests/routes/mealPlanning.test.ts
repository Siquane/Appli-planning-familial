import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import * as planner from "../../src/services/mealPlanner";
import { authHeader, signup } from "../helpers";

const prefs = { diets: ["végétarien"], weekdayTime: "express", weekendTime: "élaboré", useMyRecipes: "souvent" };

afterEach(() => {
  vi.restoreAllMocks();
  env.anthropicApiKey = "";
});

describe("POST /meals/generate", () => {
  it("answers 503 when no Claude API key is configured", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/meals/generate").set(authHeader(accessToken)).send({ slots: [{ weekday: 0, type: "dîner" }], preferences: prefs });
    expect(res.status).toBe(503);
  });

  it("passes recipes, members and the meals that stay to the planner, and returns its proposal", async () => {
    env.anthropicApiKey = "test-key";
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const recipe = await request(app).post("/recipes").set(auth).send({ title: "Lasagnes de Mamie", ingredients: [], steps: [] });
    await request(app).post("/meals").set(auth).send({ weekday: 0, type: "déjeuner", title: "Quiche" });
    await request(app).post("/meals").set(auth).send({ weekday: 0, type: "dîner", title: "Ancien dîner" });

    const spy = vi.spyOn(planner, "proposeMeals").mockResolvedValue([
      { weekday: 0, type: "dîner", title: "Lasagnes de Mamie", recipeId: recipe.body.recipe.id, notes: "" },
    ]);

    const res = await request(app)
      .post("/meals/generate")
      .set(auth)
      .send({ slots: [{ weekday: 0, type: "dîner" }], preferences: prefs, exclude: ["Pizza"] });

    expect(res.status).toBe(200);
    expect(res.body.meals).toHaveLength(1);
    const ctx = spy.mock.calls[0][0];
    expect(ctx.recipes).toEqual([{ id: recipe.body.recipe.id, title: "Lasagnes de Mamie" }]);
    // The slot being regenerated is not reported as "kept".
    expect(ctx.keptMeals).toEqual([{ weekday: 0, type: "déjeuner", title: "Quiche" }]);
    expect(ctx.exclude).toEqual(["Pizza"]);
    expect(ctx.preferences.diets).toEqual(["végétarien"]);

    // Nothing was saved by generating.
    const list = await request(app).get("/meals").set(auth);
    expect(list.body.meals.find((m: { type: string }) => m.type === "dîner").title).toBe("Ancien dîner");
  });

  it("rejects an empty slot list", async () => {
    env.anthropicApiKey = "test-key";
    const { accessToken } = await signup(app);
    const res = await request(app).post("/meals/generate").set(authHeader(accessToken)).send({ slots: [], preferences: prefs });
    expect(res.status).toBe(400);
  });

  it("turns planner failures into a 502 with a readable message", async () => {
    env.anthropicApiKey = "test-key";
    const { accessToken } = await signup(app);
    vi.spyOn(planner, "proposeMeals").mockRejectedValue(new planner.MealPlannerError("Trop de demandes"));
    const res = await request(app).post("/meals/generate").set(authHeader(accessToken)).send({ slots: [{ weekday: 1, type: "dîner" }], preferences: prefs });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("Trop de demandes");
  });
});

describe("POST /meals/bulk", () => {
  it("upserts every meal of an accepted proposal", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app).post("/meals").set(auth).send({ weekday: 2, type: "dîner", title: "Soupe" });

    const res = await request(app)
      .post("/meals/bulk")
      .set(auth)
      .send({ meals: [{ weekday: 2, type: "dîner", title: "Gratin" }, { weekday: 3, type: "déjeuner", title: "Taboulé", notes: "La veille" }] });
    expect(res.status).toBe(201);

    const list = await request(app).get("/meals").set(auth);
    expect(list.body.meals).toHaveLength(2);
    expect(list.body.meals.map((m: { title: string }) => m.title).sort()).toEqual(["Gratin", "Taboulé"]);
  });

  it("refuses a recipe that belongs to someone else", async () => {
    const other = await signup(app);
    const foreign = await request(app).post("/recipes").set(authHeader(other.accessToken)).send({ title: "Secret", ingredients: [], steps: [] });
    const { accessToken } = await signup(app);
    const res = await request(app)
      .post("/meals/bulk")
      .set(authHeader(accessToken))
      .send({ meals: [{ weekday: 1, type: "dîner", title: "Secret", recipeId: foreign.body.recipe.id }] });
    expect(res.status).toBe(400);
  });
});
