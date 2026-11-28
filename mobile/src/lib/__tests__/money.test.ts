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

describe("capCrossed", () => {
  const { capCrossed } = jest.requireActual("../money") as typeof import("../money");
  const budget = {
    month: "2026-11",
    byCategory: [
      { category: "courses", totalCents: 55000, limitCents: 60000 },
      { category: "loisirs", totalCents: 70000, limitCents: 50000 },
      { category: "autre", totalCents: 1000, limitCents: null },
    ],
  };

  it("alerts when an expense pushes the category over its cap", () => {
    expect(capCrossed(budget, { category: "courses", amountCents: 8000, date: "2026-11-12" })).toEqual({ totalCents: 63000, limitCents: 60000 });
  });

  it("stays quiet under the cap, without a cap, if already over, or for another month", () => {
    expect(capCrossed(budget, { category: "courses", amountCents: 1000, date: "2026-11-12" })).toBeNull();
    expect(capCrossed(budget, { category: "autre", amountCents: 99999, date: "2026-11-12" })).toBeNull();
    expect(capCrossed(budget, { category: "loisirs", amountCents: 100, date: "2026-11-12" })).toBeNull();
    expect(capCrossed(budget, { category: "courses", amountCents: 8000, date: "2026-12-01" })).toBeNull();
  });

  it("counts an edited expense only once", () => {
    const previous = { category: "courses", amountCents: 5000, date: "2026-11-03" };
    expect(capCrossed(budget, { category: "courses", amountCents: 9000, date: "2026-11-03" }, previous)).toBeNull();
    expect(capCrossed(budget, { category: "courses", amountCents: 11000, date: "2026-11-03" }, previous)).toEqual({ totalCents: 61000, limitCents: 60000 });
  });
});

describe("budgetToCsv", () => {
  const { budgetToCsv, centsForCsv } = jest.requireActual("../money") as typeof import("../money");

  it("writes French spreadsheet numbers", () => {
    expect(centsForCsv(123456)).toBe("1234,56");
    expect(centsForCsv(5)).toBe("0,05");
  });

  it("lists the month's expenses oldest first with a total, quoting tricky labels", () => {
    const csv = budgetToCsv(
      [
        { date: "2026-11-12", label: 'Cinéma "Dune"; IMAX', category: "loisirs", memberId: "m1", amountCents: 2400, recurringId: null },
        { date: "2026-11-05", label: "Loyer", category: "logement", memberId: null, amountCents: 90000, recurringId: "r1" },
      ],
      (c) => ({ loisirs: "Loisirs", logement: "Logement" })[c] ?? c,
      (id) => (id === "m1" ? "Léa" : ""),
    );
    expect(csv.split("\n")).toEqual([
      "Date;Libellé;Catégorie;Pour qui;Montant (€);Récurrente",
      "2026-11-05;Loyer;Logement;;900,00;oui",
      '2026-11-12;"Cinéma ""Dune""; IMAX";Loisirs;Léa;24,00;',
      ";Total;;;924,00;",
    ]);
  });
});

describe("monthRing", () => {
  const { monthRing } = require("../money");
  it("montre la part des plafonds utilisée", () => {
    expect(monthRing("2026-11", 100000, 77000)).toMatchObject({ percent: 77, caption: "des plafonds" });
  });
  it("sans plafond, montre l'avancée du mois", () => {
    expect(monthRing("2026-11", 0, 0, new Date(2026, 10, 15))).toMatchObject({ done: 15, total: 30, percent: 50, caption: "du mois" });
    expect(monthRing("2026-10", 0, 0, new Date(2026, 10, 15))).toMatchObject({ done: 31, total: 31, percent: 100 });
  });
});
