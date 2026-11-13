jest.mock("expo-file-system", () => ({ File: jest.fn(), Paths: {} }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
import { periodRange } from "../exportExpenses";

describe("periodRange", () => {
  it("turns a period choice into the months to export", () => {
    expect(periodRange("month", "2026-11")).toEqual(["2026-11", "2026-11"]);
    expect(periodRange("3months", "2026-02")).toEqual(["2025-12", "2026-02"]);
    expect(periodRange("year", "2026-11")).toEqual(["2026-01", "2026-11"]);
    expect(periodRange("lastYear", "2026-11")).toEqual(["2025-01", "2025-12"]);
  });
});
