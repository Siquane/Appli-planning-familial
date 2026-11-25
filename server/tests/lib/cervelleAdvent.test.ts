import { describe, expect, it } from "vitest";
import { ADVENT, ADVENT_ITEMS, adventCells, adventPhase, adventYear, daysUntilStart, keysOf } from "../../src/lib/cervelle/advent";
import { SHOP, onSale } from "../../src/lib/cervelle/shop";
import { howToGet } from "../../src/lib/cervelle/howToGet";
import { starsOf } from "../../src/lib/cervelle/stars";

describe("Cervelle — calendrier de l'Avent", () => {
  it("has 24 boxes, an item every 4 days, each item in the shop but not for sale", () => {
    expect(ADVENT).toHaveLength(24);
    expect(ADVENT_ITEMS.map((a) => a.day)).toEqual([4, 8, 12, 16, 20, 24]);
    for (const { item } of ADVENT_ITEMS) {
      const it = SHOP.find((i) => i.id === item)!;
      expect(it).toMatchObject({ kind: "avent", price: 0 });
      expect(onSale(it, "2026-12-10")).toBe(false);
      expect(howToGet(it, "2026-12-10")).toContain("calendrier de l'Avent");
    }
  });

  it("shows from 20 November to 6 January", () => {
    expect(adventYear("2026-11-19")).toBeNull();
    expect(adventYear("2026-11-25")).toBe(2026);
    expect(adventYear("2027-01-06")).toBe(2026);
    expect(adventYear("2027-01-07")).toBeNull();
    expect(adventPhase(2026, "2026-11-25")).toBe("bientot");
    expect(adventPhase(2026, "2026-12-24")).toBe("ouvert");
    expect(adventPhase(2026, "2026-12-25")).toBe("rattrapage");
    expect(daysUntilStart(2026, "2026-11-25")).toBe(6);
  });

  it("gives a key a revision day, two with two revisions (to catch up)", () => {
    const sessions = { "2026-11-30": 5, "2026-12-01": 1, "2026-12-03": 4, "2026-12-04": 2 };
    expect(keysOf(sessions, 2026, "2026-12-04")).toBe(5);
    expect(keysOf(sessions, 2026, "2026-12-03")).toBe(3);
  });

  it("opens a box from its day, only with a key left", () => {
    const cells = adventCells(2026, "2026-12-03", new Set([1]), 2);
    expect(cells.slice(0, 4).map((c) => [c.opened, c.arrived, c.openable])).toEqual([
      [true, true, false],
      [false, true, true],
      [false, true, true],
      [false, false, false],
    ]);
    // No key left: nothing opens.
    expect(adventCells(2026, "2026-12-03", new Set([1, 2]), 2).some((c) => c.openable)).toBe(false);
    // After 6 January: closed.
    expect(adventCells(2026, "2027-01-07", new Set(), 10).some((c) => c.openable)).toBe(false);
  });

  it("adds the bonus stars to the path", () => {
    const base = { quizzes: [], interros: 0, studyDays: [], chests: 1, wins: 0, badges: 0 };
    expect(starsOf({ ...base, bonus: 5 })).toMatchObject({ total: 8, missions: 8 });
  });
});
