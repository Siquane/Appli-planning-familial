import { describe, expect, it } from "vitest";
import { coinsFor, computeBadges, easter, seasonWindow, tierOf, type BadgeStats } from "../../src/lib/cervelle/badges";

const zero: BadgeStats = { revisions: 0, subjects: 0, perfectQuizzes: 0, mastered: 0, bestInterro20: 0, bestStreak: 0, focusSessions: 0, preparedExams: 0, answers: 0, minutes: 0 };

describe("Cervelle — badges", () => {
  it("counts tiers", () => {
    expect(tierOf(0, [1, 10, 50])).toBe(0);
    expect(tierOf(1, [1, 10, 50])).toBe(1);
    expect(tierOf(49, [1, 10, 50])).toBe(2);
    expect(tierOf(80, [1, 10, 50])).toBe(3);
  });

  it("knows Easter and the seasons", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    expect(seasonWindow("2026-11-17")).toMatchObject({ key: "saison:automne:2026", from: "2026-09-22", to: "2026-12-20" });
    // Winter is named after the year it starts in.
    expect(seasonWindow("2027-02-10")).toMatchObject({ key: "saison:hiver:2026", from: "2026-12-21", to: "2027-03-19" });
    expect(seasonWindow("2026-12-21").key).toBe("saison:hiver:2026");
  });

  it("earns every tier reached, with what is left for the next one", () => {
    const v = computeBadges({ ...zero, revisions: 12, perfectQuizzes: 1, bestInterro20: 20 }, [], "2026-11-17");
    expect(v.earnedKeys).toEqual(expect.arrayContaining(["photographe:1", "photographe:2", "sans_faute:1", "as_interro:1", "as_interro:2", "as_interro:3"]));
    const photo = v.successes.find((s) => s.id === "photographe")!;
    expect(photo.tier).toBe(2);
    expect(photo.next).toMatchObject({ target: 50, left: "Encore 38 cours en photo" });
    expect(v.successes.find((s) => s.id === "as_interro")!.next).toBeNull();
    expect(v.successes.find((s) => s.id === "regulier")!.tier).toBe(0);
  });

  it("earns a season after 10 days and a holiday after one", () => {
    const autumn = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    const v = computeBadges(zero, [...autumn, "2026-10-31", "2026-10-31"], "2026-11-17");
    expect(v.earnedKeys).toContain("saison:automne:2026");
    expect(v.earnedKeys).toContain("fete:halloween:2026");
    expect(v.earnedKeys).not.toContain("fete:rentree:2026");
    // Missed ones are hidden; the season in progress and the next holiday are shown.
    const keys = v.windows.map((w) => w.key);
    expect(keys).not.toContain("fete:rentree:2026");
    expect(keys).toContain("fete:noel:2026");
    expect(v.windows.filter((w) => w.when === "soon")).toHaveLength(1);
  });

  it("shows the season in progress with its count", () => {
    const v = computeBadges(zero, ["2026-11-01", "2026-11-02"], "2026-11-17");
    expect(v.windows.find((w) => w.key === "saison:automne:2026")).toMatchObject({ earned: false, when: "now", days: 2, needs: 10 });
  });

  it("pays by tier, season and holiday", () => {
    expect(coinsFor("photographe:1")).toBe(10);
    expect(coinsFor("photographe:3")).toBe(50);
    expect(coinsFor("saison:hiver:2026")).toBe(25);
    expect(coinsFor("fete:noel:2026")).toBe(15);
  });
});
