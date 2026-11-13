import { describe, expect, it } from "vitest";
import { forecastMonth } from "../../src/lib/forecast";

const base = { daysInMonth: 30, recurringCents: 100000, upcomingRecurringCents: 0, plannedVariableCents: 0, previousVariableCents: [] as number[] };

describe("forecastMonth", () => {
  it("extrapolates the pace when there is no history, recurring counted in full", () => {
    const f = forecastMonth({ ...base, today: 10, variableSoFarCents: 20000, upcomingRecurringCents: 30000 });
    expect(f).toEqual({ spentCents: 90000, upcomingRecurringCents: 30000, projectedCents: 160000, usualCents: null });
  });

  it("leans on past months early in the month, on the current pace later", () => {
    const early = forecastMonth({ ...base, today: 3, variableSoFarCents: 30000, previousVariableCents: [60000, 60000] }, [160000, 160000]);
    // pace = 300 000, history = 60 000, weight 0.1 -> 84 000 variable
    expect(early.projectedCents).toBe(184000);
    expect(early.usualCents).toBe(160000);

    const late = forecastMonth({ ...base, today: 27, variableSoFarCents: 54000, previousVariableCents: [60000] });
    // pace = 60 000, weight 0.9 -> 60 000
    expect(late.projectedCents).toBe(160000);
  });

  it("never forecasts less than what is already spent or planned", () => {
    const f = forecastMonth({ ...base, today: 2, variableSoFarCents: 5000, plannedVariableCents: 80000, previousVariableCents: [10000] });
    expect(f.projectedCents).toBe(185000);
  });
});
