import { centsToInput, currentMonth, formatEuros, fromDayString, monthLabel, parseAmount, shiftMonth, shortDay, toDayString } from "../money";

describe("parseAmount", () => {
  it("reads French and English decimals, spaces and the euro sign", () => {
    expect(parseAmount("12,50")).toBe(1250);
    expect(parseAmount("12.5")).toBe(1250);
    expect(parseAmount("1 200")).toBe(120000);
    expect(parseAmount("8 €")).toBe(800);
    expect(parseAmount("0,10")).toBe(10);
  });

  it("rejects empty, zero, negative and over-precise amounts", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1,234")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });

  it("round-trips with centsToInput", () => {
    expect(parseAmount(centsToInput(1205))).toBe(1205);
    expect(centsToInput(800)).toBe("8,00");
  });
});

describe("formatEuros", () => {
  it("formats in French style", () => {
    expect(formatEuros(123456)).toBe("1 234,56 €");
    expect(formatEuros(5)).toBe("0,05 €");
    expect(formatEuros(0)).toBe("0,00 €");
  });
});

describe("months and days", () => {
  it("shifts across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("labels months and days in French", () => {
    expect(monthLabel("2026-11")).toBe("Novembre 2026");
    expect(shortDay("2026-07-14")).toBe("14 juil.");
  });

  it("uses the local calendar day, not UTC", () => {
    const lateEvening = new Date(2026, 10, 30, 23, 45);
    expect(toDayString(lateEvening)).toBe("2026-11-30");
    expect(currentMonth(lateEvening)).toBe("2026-11");
    expect(toDayString(fromDayString("2026-03-29"))).toBe("2026-03-29");
  });
});

describe("category options", () => {
  const { buildCategoryOptions, categoryLabel } = jest.requireActual("../money") as typeof import("../money");

  it("puts custom categories before 'Divers' and labels unknown ids as 'Divers'", () => {
    const options = buildCategoryOptions([{ id: "c1", name: "Jardin" }]);
    expect(options.map((o) => o.label).slice(-3)).toEqual(["Cadeaux", "Jardin", "Divers"]);
    expect(categoryLabel(options, "c1")).toBe("Jardin");
    expect(categoryLabel(options, "assurances")).toBe("Assurances");
    expect(categoryLabel(options, "deleted-id")).toBe("Divers");
  });
});
