import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { app } from "../../src/index";
import { importRecipeFromUrl, isPrivateAddress, parseRecipeFromHtml } from "../../src/lib/recipeImport";
import { authHeader, signup } from "../helpers";

const page = (jsonLd: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>…</body></html>`;

describe("parseRecipeFromHtml", () => {
  it("reads a recipe inside an @graph with HowToStep instructions", () => {
    const html = page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebSite", name: "Cuisine" },
        {
          "@type": ["Recipe", "NewsArticle"],
          name: "Gratin de courgettes",
          recipeYield: ["4 personnes"],
          recipeIngredient: ["2 courgettes", " 20 cl de crème&nbsp;fraîche ", "100 g d&#39;emmental"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Couper les courgettes." },
            { "@type": "HowToSection", name: "Cuisson", itemListElement: [{ "@type": "HowToStep", text: "Enfourner <b>30 min</b>." }] },
          ],
        },
      ],
    });
    expect(parseRecipeFromHtml(html)).toEqual({
      title: "Gratin de courgettes",
      ingredients: ["2 courgettes", "20 cl de crème fraîche", "100 g d'emmental"],
      steps: ["Couper les courgettes.", "Enfourner 30 min."],
      notes: "Pour 4 personnes.",
    });
  });

  it("splits plain-text instructions into steps", () => {
    const html = page({ "@type": "Recipe", name: "Crêpes", recipeIngredient: ["250 g de farine"], recipeInstructions: "Mélanger.\nLaisser reposer.\nCuire." });
    expect(parseRecipeFromHtml(html)?.steps).toEqual(["Mélanger.", "Laisser reposer.", "Cuire."]);
  });

  it("returns null when the page has no recipe, or broken JSON", () => {
    expect(parseRecipeFromHtml("<html><body>Pas de recette</body></html>")).toBeNull();
    expect(parseRecipeFromHtml('<script type="application/ld+json">{oops</script>')).toBeNull();
    expect(parseRecipeFromHtml(page({ "@type": "Article", name: "Actu" }))).toBeNull();
  });
});

describe("importRecipeFromUrl", () => {
  it("flags private and loopback addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
  });

  it("refuses internal addresses and non-web links before fetching anything", async () => {
    const fetchSpy = vi.fn();
    await expect(importRecipeFromUrl("http://127.0.0.1:4000/health", fetchSpy as never)).rejects.toThrow(/non autorisée/);
    await expect(importRecipeFromUrl("http://169.254.169.254/latest", fetchSpy as never)).rejects.toThrow(/non autorisée/);
    await expect(importRecipeFromUrl("file:///etc/passwd", fetchSpy as never)).rejects.toThrow(/http/);
    await expect(importRecipeFromUrl("pas une adresse", fetchSpy as never)).rejects.toThrow(/invalide/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("downloads a public page and returns its recipe", async () => {
    const fetchSpy = vi.fn(async () => new Response(page({ "@type": "Recipe", name: "Tarte", recipeIngredient: ["3 pommes"] }), { status: 200 }));
    const recipe = await importRecipeFromUrl("https://93.184.216.34/tarte", fetchSpy as never);
    expect(recipe).toMatchObject({ title: "Tarte", ingredients: ["3 pommes"] });
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ redirect: "error" });
  });
});

describe("POST /recipes/import", () => {
  it("answers 422 with a message the app can show", async () => {
    const { accessToken } = await signup(app);
    const res = await request(app).post("/recipes/import").set(authHeader(accessToken)).send({ url: "http://127.0.0.1/" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/non autorisée/);
  });
});
