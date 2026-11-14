import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { authHeader, signup } from "../helpers";

describe("shopping list", () => {
  it("adds, checks, renames and removes items", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);

    const created = await request(app).post("/shopping").set(auth).send({ label: "Pain" });
    expect(created.status).toBe(201);
    const id = created.body.item.id;

    const checked = await request(app).patch(`/shopping/${id}`).set(auth).send({ checked: true });
    expect(checked.body.item).toMatchObject({ label: "Pain", checked: true });

    // A PATCH without « checked » must not reset it (zod default).
    const renamed = await request(app).patch(`/shopping/${id}`).set(auth).send({ label: "Pain complet" });
    expect(renamed.body.item).toMatchObject({ label: "Pain complet", checked: true });

    await request(app).delete(`/shopping/${id}`).set(auth).expect(204);
    expect((await request(app).get("/shopping").set(auth)).body.items).toHaveLength(0);
  });

  it("generates the list from the week's recipes without duplicates", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const gratin = await request(app).post("/recipes").set(auth).send({ title: "Gratin", ingredients: ["2 courgettes", "Crème", "Gruyère"] });
    const quiche = await request(app).post("/recipes").set(auth).send({ title: "Quiche", ingredients: ["crème", "3 œufs"] });
    await request(app).post("/meals").set(auth).send({ weekday: 0, type: "dîner", recipeId: gratin.body.recipe.id });
    await request(app).post("/meals").set(auth).send({ weekday: 2, type: "déjeuner", recipeId: quiche.body.recipe.id });
    await request(app).post("/meals").set(auth).send({ weekday: 3, type: "dîner", title: "Restes" });
    await request(app).post("/shopping").set(auth).send({ label: "Gruyère" });

    const res = await request(app).post("/shopping/from-menu").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(3);
    expect(res.body.items.map((i: { label: string }) => i.label).sort()).toEqual(["2 courgettes", "3 œufs", "Crème", "Gruyère"].sort());

    // Running it again adds nothing.
    expect((await request(app).post("/shopping/from-menu").set(auth)).body.added).toBe(0);
  });

  it("adds the ingredients of generated dishes and reports dishes without any", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    // Saved from a generated proposal: the dish comes with its ingredients.
    await request(app)
      .post("/meals/bulk")
      .set(auth)
      .send({ meals: [{ weekday: 0, type: "dîner", title: "Curry de poulet", ingredients: ["400 g de poulet", "Lait de coco"] }] });
    // Typed by hand: no ingredients.
    await request(app).post("/meals").set(auth).send({ weekday: 1, type: "dîner", title: "Pizza maison" });

    const res = await request(app).post("/shopping/from-menu").set(auth);
    expect(res.body.added).toBe(2);
    expect(res.body.withoutIngredients).toBe(1);
    expect(res.body.items.map((i: { label: string }) => i.label).sort()).toEqual(["400 g de poulet", "Lait de coco"]);
  });

  it("keeps a dish's ingredients when only its notes change, drops them when it becomes another dish", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app)
      .post("/meals/bulk")
      .set(auth)
      .send({ meals: [{ weekday: 0, type: "dîner", title: "Curry de poulet", ingredients: ["400 g de poulet"] }] });

    const noted = await request(app).post("/meals").set(auth).send({ weekday: 0, type: "dîner", title: "Curry de poulet", notes: "Riz à part" });
    expect(noted.body.meal.ingredients).toEqual(["400 g de poulet"]);

    const renamed = await request(app).post("/meals").set(auth).send({ weekday: 0, type: "dîner", title: "Omelette" });
    expect(renamed.body.meal.ingredients).toEqual([]);
  });

  it("clears checked items only", async () => {
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    await request(app).post("/shopping").set(auth).send({ label: "Lait", checked: true });
    await request(app).post("/shopping").set(auth).send({ label: "Beurre" });
    const res = await request(app).delete("/shopping/checked").set(auth);
    expect(res.body.removed).toBe(1);
    expect(res.body.items.map((i: { label: string }) => i.label)).toEqual(["Beurre"]);
  });

  it("keeps each family's list private", async () => {
    const a = await signup(app, { email: "a@passerelle.test" });
    const b = await signup(app, { email: "b@passerelle.test" });
    const item = await request(app).post("/shopping").set(authHeader(a.accessToken)).send({ label: "Pain" });
    expect((await request(app).get("/shopping").set(authHeader(b.accessToken))).body.items).toHaveLength(0);
    expect((await request(app).patch(`/shopping/${item.body.item.id}`).set(authHeader(b.accessToken)).send({ checked: true })).status).toBe(404);
    expect((await request(app).delete(`/shopping/${item.body.item.id}`).set(authHeader(b.accessToken))).status).toBe(404);
  });
});
