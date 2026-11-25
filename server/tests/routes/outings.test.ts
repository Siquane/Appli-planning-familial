import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/index";
import { prisma } from "../../src/db";
import { parisDay, addDays } from "../../src/lib/cervelle/days";
import { buildPrompt, describeWeather, setOutingsFetch, setOutingsProposer, type IdeasContext } from "../../src/services/outings";
import { env } from "../../src/env";
import { authHeader, signup } from "../helpers";

describe("Sorties & idées", () => {
  const key = env.anthropicApiKey;
  afterEach(() => {
    (env as { anthropicApiKey: string }).anthropicApiKey = key;
  });

  it("describes the weather and writes a prompt without names", () => {
    expect(describeWeather(0)).toEqual({ label: "Grand soleil", emoji: "☀️" });
    expect(describeWeather(63).label).toBe("Pluie");
    const c: IdeasContext = { dayLabel: "samedi 28", moment: "journee", city: "Lyon", weather: { code: 61, label: "Pluie", emoji: "🌧️", tMin: 4, tMax: 9, rain: 80 }, ages: [40, 38, 8, 11], busy: ["10:00-11:00 Piscine"], exclude: [] };
    const p = buildPrompt(c);
    expect(p).toContain("Pluie, 4 à 9 °C, risque de pluie 80 %");
    expect(p).toContain("2 adulte(s), enfants de 8, 11 ans");
    expect(p).toContain("10:00-11:00 Piscine");
  });

  it("gives 5 ideas with the weather, saves the city, and blocks child accounts", async () => {
    (env as { anthropicApiKey: string }).anthropicApiKey = "test";
    let seen: IdeasContext | null = null;
    setOutingsProposer(async (c) => {
      seen = c;
      return Array.from({ length: 6 }, (_, i) => ({ emoji: "🎨", title: `Idée ${i}`, description: "Pour s'amuser.", place: "dedans" as const, cost: "gratuit" as const, minutes: 50, start: i === 0 ? "25:00" : "15:00" }));
    });
    setOutingsFetch(async (url) => ({
      ok: true,
      json: async () =>
        url.includes("geocoding")
          ? { results: [{ name: "Lyon", latitude: 45.75, longitude: 4.85 }] }
          : { daily: { weather_code: [61], temperature_2m_max: [9.4], temperature_2m_min: [3.6], precipitation_probability_max: [80] } },
    }));
    const { accessToken } = await signup(app);
    const auth = authHeader(accessToken);
    const day = addDays(parisDay(), 2);
    const res = await request(app).post("/outings/ideas").set(auth).send({ day, moment: "journee", city: "lyon" });
    expect(res.status).toBe(200);
    expect(res.body.weather).toMatchObject({ label: "Pluie", tMin: 4, tMax: 9, rain: 80 });
    expect(res.body.ideas).toHaveLength(5);
    // A wrong time gets a sensible one; durations are rounded to 15 minutes.
    expect(res.body.ideas[0]).toMatchObject({ start: "14:00", minutes: 45 });
    expect(seen!.city).toBe("Lyon");
    expect((await request(app).get("/outings/settings").set(auth)).body.city).toBe("lyon");

    expect((await request(app).post("/outings/ideas").set(auth).send({ day: addDays(parisDay(), 30), moment: "soir" })).status).toBe(400);
  });
});
