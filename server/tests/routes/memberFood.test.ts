import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { env } from "../../src/env";
import * as planner from "../../src/services/mealPlanner";
import { authHeader, signup } from "../helpers";

afterEach(() => {
  vi.restoreAllMocks();
  env.anthropicApiKey = "";
});

async function familyWithMember() {
  const { accessToken } = await signup(app);
  const auth = authHeader(accessToken);
  const created = await request(app).post("/members").set(auth).send({ name: "Léo", age: 8 });
  return { auth, memberId: created.body.member.id as string };
}

describe("préférences repas d'un membre", () => {
  it("stores tastes, appetite and canteen days without consent", async () => {
    const { auth, memberId } = await familyWithMember();
    const res = await request(app)
      .patch(`/members/${memberId}`)
      .set(auth)
      .send({ favoriteFoods: "lasagnes", dislikedFoods: "champignons", appetite: "gros", canteenDays: [0, 3], foodNotes: "mange lentement" });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ favoriteFoods: "lasagnes", dislikedFoods: "champignons", appetite: "gros", canteenDays: [0, 3], foodNotes: "mange lentement" });
  });

  it("refuses diets, allergies and foods to limit until consent is given", async () => {
    const { auth, memberId } = await familyWithMember();
    expect((await request(app).patch(`/members/${memberId}`).set(auth).send({ allergies: "arachides" })).status).toBe(403);
    expect((await request(app).patch(`/members/${memberId}`).set(auth).send({ diets: ["halal"] })).status).toBe(403);
    // Clearing them is always allowed.
    expect((await request(app).patch(`/members/${memberId}`).set(auth).send({ allergies: "", diets: [] })).status).toBe(200);

    expect((await request(app).get("/members/food-consent").set(auth)).body.consentedAt).toBeNull();
    const consent = await request(app).post("/members/food-consent").set(auth);
    expect(consent.body.consentedAt).toEqual(expect.any(String));

    const res = await request(app).patch(`/members/${memberId}`).set(auth).send({ allergies: "arachides", diets: ["halal"], foodsToLimit: "sucre" });
    expect(res.status).toBe(200);
    expect(res.body.member).toMatchObject({ allergies: "arachides", diets: ["halal"], foodsToLimit: "sucre" });
  });

  it("erases the sensitive fields of every member when consent is withdrawn", async () => {
    const { auth, memberId } = await familyWithMember();
    await request(app).post("/members/food-consent").set(auth);
    await request(app).patch(`/members/${memberId}`).set(auth).send({ allergies: "arachides", diets: ["végétarien"], foodsToLimit: "sel", favoriteFoods: "pâtes" });

    expect((await request(app).delete("/members/food-consent").set(auth)).status).toBe(204);
    const list = await request(app).get("/members").set(auth);
    expect(list.body.members[0]).toMatchObject({ allergies: "", diets: [], foodsToLimit: "", favoriteFoods: "pâtes" });
    expect((await request(app).get("/members/food-consent").set(auth)).body.consentedAt).toBeNull();
  });

  it("sends members to the menu planner without their names", async () => {
    env.anthropicApiKey = "test-key";
    const { auth, memberId } = await familyWithMember();
    await request(app).post("/members/food-consent").set(auth);
    await request(app).patch(`/members/${memberId}`).set(auth).send({ allergies: "arachides", dislikedFoods: "épinards" });
    const spy = vi.spyOn(planner, "proposeMeals").mockResolvedValue([]);

    const prefs = { diets: [], allergies: "", weekdayTime: "normal", weekendTime: "normal", fishPerWeek: null, veggiePerWeek: null, useMyRecipes: "parfois", wishes: "", avoid: "" };
    await request(app).post("/meals/generate").set(auth).send({ slots: [{ weekday: 0, type: "dîner" }], preferences: prefs });

    const ctx = spy.mock.calls[0][0];
    expect(ctx.members).toEqual([expect.objectContaining({ label: "Enfant 1", age: 8, allergies: "arachides", dislikedFoods: "épinards" })]);
    expect(JSON.stringify(ctx)).not.toContain("Léo");
  });
});
