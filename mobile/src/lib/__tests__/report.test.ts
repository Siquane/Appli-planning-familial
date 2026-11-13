import { compareMonths } from "../report";
import { monthsLeft, shortMonthLabel } from "../money";

describe("compareMonths", () => {
  it("lists the biggest changes first, with a % only when there was spending before", () => {
    const previous = { month: "2026-10", totalCents: 30000, byCategory: [{ category: "courses", totalCents: 20000 }, { category: "loisirs", totalCents: 10000 }] };
    const current = { month: "2026-11", totalCents: 31000, byCategory: [{ category: "courses", totalCents: 25000 }, { category: "restaurants", totalCents: 6000 }] };
    expect(compareMonths(current, previous)).toEqual([
      { category: "loisirs", deltaCents: -10000, percent: -100 },
      { category: "restaurants", deltaCents: 6000, percent: null },
      { category: "courses", deltaCents: 5000, percent: 25 },
    ]);
  });
});

describe("money helpers", () => {
  it("counts the months left until a deadline, at least one", () => {
    const now = new Date(2026, 10, 13);
    expect(monthsLeft("2027-07-01", now)).toBe(8);
    expect(monthsLeft("2026-11-30", now)).toBe(1);
    expect(monthsLeft(null, now)).toBeNull();
  });

  it("gives the short month name", () => {
    expect(shortMonthLabel("2026-02")).toBe("févr.");
  });
});
