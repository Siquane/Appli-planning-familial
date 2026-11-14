import { parseDuration, splitDuration } from "../duration";

describe("custom task duration", () => {
  it("reads hours and minutes", () => {
    expect(parseDuration("1", "15")).toBe(75);
    expect(parseDuration("", "40")).toBe(40);
    expect(parseDuration("2", "")).toBe(120);
  });

  it("refuses what the server would refuse", () => {
    expect(parseDuration("", "")).toBeNull();
    expect(parseDuration("0", "3")).toBeNull();
    expect(parseDuration("8", "30")).toBeNull();
    expect(parseDuration("1", "75")).toBeNull();
    expect(parseDuration("1,5", "")).toBeNull();
  });

  it("splits a duration back into the fields", () => {
    expect(splitDuration(75)).toEqual({ hours: "1", minutes: "15" });
    expect(splitDuration(40)).toEqual({ hours: "0", minutes: "40" });
  });
});
