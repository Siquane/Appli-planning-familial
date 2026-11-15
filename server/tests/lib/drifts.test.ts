import { describe, expect, it } from "vitest";
import { findDrifts, shiftMonthKey } from "../../src/lib/drifts";

const t = (o: Record<string, number>) => new Map(Object.entries(o));

describe("findDrifts", () => {
  it("flags a category at least 25 % and 20 € above its 3-month average", () => {
    const drifts = findDrifts(t({ courses: 500_00, loisirs: 60_00 }), [t({ courses: 380_00, loisirs: 50_00 }), t({ courses: 400_00, loisirs: 50_00 }), t({ courses: 420_00, loisirs: 50_00 })]);
    expect(drifts).toEqual([{ category: "courses", totalCents: 500_00, averageCents: 400_00, increaseCents: 100_00, increasePct: 25 }]);
  });

  it("needs both the % and the € threshold", () => {
    // +50 % but only +10 €
    expect(findDrifts(t({ loisirs: 30_00 }), [t({ loisirs: 20_00 }), t({ loisirs: 20_00 }), t({ loisirs: 20_00 })])).toEqual([]);
    // +30 € but only +10 %
    expect(findDrifts(t({ courses: 330_00 }), [t({ courses: 300_00 }), t({ courses: 300_00 }), t({ courses: 300_00 })])).toEqual([]);
  });

  it("ignores new or one-off categories and savings", () => {
    expect(findDrifts(t({ santé: 200_00 }), [t({}), t({}), t({ santé: 30_00 })])).toEqual([]);
    expect(findDrifts(t({ épargne: 900_00 }), [t({ épargne: 100_00 }), t({ épargne: 100_00 }), t({ épargne: 100_00 })])).toEqual([]);
  });

  it("counts a month without spending as 0 in the average", () => {
    const [d] = findDrifts(t({ transport: 120_00 }), [t({ transport: 90_00 }), t({}), t({ transport: 90_00 })]);
    expect(d.averageCents).toBe(60_00);
  });
});

it("shiftMonthKey", () => {
  expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
  expect(shiftMonthKey("2026-11", 2)).toBe("2027-01");
});
