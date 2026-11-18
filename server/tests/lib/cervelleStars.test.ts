import { describe, expect, it } from "vitest";
import { monthRange, openChest, starsOf, STEPS, themeOf } from "../../src/lib/cervelle/stars";

const none = { quizzes: [], interros: 0, studyDays: [], chests: 0, wins: 0, badges: 0 };

describe("Cervelle — chemin d'étoiles", () => {
  it("counts stars from revising, regularity, missions, duels and badges", () => {
    const s = starsOf({ ...none, quizzes: [{ mode: "a_revoir", total: 6 }, { mode: "qcm", total: 5 }], interros: 1, studyDays: ["2026-11-02", "2026-11-02", "2026-11-03"], chests: 2, wins: 1, badges: 1 });
    expect(s).toEqual({ revision: 3 + 2, regularite: 2, missions: 6, defis: 3 + 2, total: 5 + 2 + 6 + 5 });
  });

  it("gives a bonus for each full week in a row", () => {
    const days = Array.from({ length: 15 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);
    expect(starsOf({ ...none, studyDays: days }).regularite).toBe(15 + 2 * 5);
    // A gap breaks the run.
    expect(starsOf({ ...none, studyDays: days.filter((d) => d !== "2026-11-04") }).regularite).toBe(14 + 5);
  });

  it("knows months and themes, and ends with the item", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(themeOf("2026-11").id).not.toBe(themeOf("2026-12").id);
    expect(STEPS.at(-1)).toEqual({ at: 50, reward: { type: "item" } });
  });

  it("opens chests: coins most of the time, sometimes an item still to win", () => {
    expect(openChest(() => 0.9, ["casquette"])).toEqual({ coins: 15 + 45, item: null });
    expect(openChest(() => 0.1, ["casquette"])).toEqual({ coins: 0, item: "casquette" });
    expect(openChest(() => 0.1, []).item).toBeNull();
  });
});
