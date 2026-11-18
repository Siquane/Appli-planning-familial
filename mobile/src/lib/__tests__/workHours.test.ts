import { workSummary } from "../workHours";

describe("workSummary", () => {
  it("returns null without working days", () => {
    expect(workSummary(undefined)).toBeNull();
    expect(workSummary({ days: [], start: "09:00", end: "17:30" })).toBeNull();
  });

  it("shortens a run of days", () => {
    expect(workSummary({ days: [4, 0, 1, 2, 3], start: "09:00", end: "17:30" })).toBe("Lun–Ven 09:00–17:30");
  });

  it("lists scattered days", () => {
    expect(workSummary({ days: [0, 2, 4], start: "08:00", end: "12:00" })).toBe("Lun, Mer, Ven 08:00–12:00");
  });
});
