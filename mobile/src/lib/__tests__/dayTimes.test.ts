import { allTimesValid, describeSchedule, resolveTimes } from "../dayTimes";

describe("resolveTimes", () => {
  it("uses the shared time for every day when per-day times are off", () => {
    expect(resolveTimes([3, 1], "08:00", false, { 1: "11:30" })).toEqual({ 1: "08:00", 3: "08:00" });
  });

  it("uses each day's own time when per-day times are on, falling back to the shared time", () => {
    expect(resolveTimes([1, 3], "08:00", true, { 1: "11:30" })).toEqual({ 1: "11:30", 3: "08:00" });
  });

  it("ignores times kept for days that are no longer selected", () => {
    expect(resolveTimes([1], "08:00", true, { 1: "11:30", 4: "17:00" })).toEqual({ 1: "11:30" });
  });
});

describe("describeSchedule", () => {
  it("groups days sharing one time", () => {
    expect(describeSchedule({ 3: "08:00", 1: "08:00" })).toBe("Mar · Jeu — 08:00");
  });

  it("lists each day with its own time otherwise", () => {
    expect(describeSchedule({ 1: "11:30", 3: "17:00" })).toBe("Mar 11:30 · Jeu 17:00");
  });
});

describe("allTimesValid", () => {
  it("checks every day has an HH:MM time", () => {
    expect(allTimesValid({ 1: "11:30", 3: "17:00" })).toBe(true);
    expect(allTimesValid({ 1: "11:30", 3: "" })).toBe(false);
  });
});
