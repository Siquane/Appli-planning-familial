import { describe, expect, it } from "vitest";
import { findReferenceDate, labelKey, parseAmountCents, parseStatement, type TextItem } from "../../src/lib/statementParser";
import { categorize, looksRecurring } from "../../src/lib/statementCategories";
import { readPdfItems } from "../../src/lib/statementPdf";
import { FAKE_CREDITS_TOTAL_CENTS, FAKE_DEBITS_TOTAL_CENTS, fakeStatementPdf } from "../statementPdf";

describe("parseAmountCents", () => {
  it("reads French amounts", () => {
    expect(parseAmountCents("1 234,56")).toEqual({ cents: 123456, sign: 0 });
    expect(parseAmountCents("1.234,56")?.cents).toBe(123456);
    expect(parseAmountCents("12,50")?.cents).toBe(1250);
    expect(parseAmountCents("-12,50")).toEqual({ cents: 1250, sign: -1 });
    expect(parseAmountCents("12,50-")).toEqual({ cents: 1250, sign: -1 });
    expect(parseAmountCents("+7,00")).toEqual({ cents: 700, sign: 1 });
    expect(parseAmountCents("12.50")?.cents).toBe(1250);
  });

  it("refuses what isn't an amount", () => {
    for (const s of ["", "abc", "05.10", "12", "1 234", "X0291"]) expect(parseAmountCents(s)).toBeNull();
  });
});

describe("labelKey", () => {
  it("keeps the merchant, without card number, date or digits", () => {
    expect(labelKey("X0291 Carrefour City Besan 17/10")).toBe("carrefour city besan");
    expect(labelKey("Carrefour City Lyon 03/10")).toBe(labelKey("Carrefour City Lyon 25/10"));
    expect(labelKey("Prlv 0217635 Crédit Agricole")).toBe("credit agricole");
  });
});

describe("findReferenceDate", () => {
  it("reads « Date d'arrêté » and falls back to the latest full date", () => {
    expect(findReferenceDate(["Date d'arrêté : 02 Novembre 2026"], new Date(0)).toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(findReferenceDate(["solde au 15.03.2026 puis au 02.04.2026"], new Date(0)).toISOString().slice(0, 10)).toBe("2026-04-02");
    expect(findReferenceDate(["rien"], new Date("2026-05-05")).toISOString().slice(0, 10)).toBe("2026-05-05");
  });
});

describe("parseStatement without column titles (signed amounts)", () => {
  const item = (str: string, x: number, y: number, width = 30): TextItem => ({ str, x, y, width });
  it("uses the sign: « - » is a debit, the rest a credit", () => {
    const rows = parseStatement(
      [
        [
          item("05/10/2026", 10, 700),
          item("PAIEMENT CB LIDL", 80, 700, 90),
          item("-45,10", 300, 700),
          item("06/10/2026", 10, 688),
          item("VIREMENT SALAIRE", 80, 688, 90),
          item("1 500,00", 300, 688),
        ],
      ],
      new Date("2026-11-01"),
    ).rows;
    expect(rows).toMatchObject([
      { date: "2026-10-05", amountCents: 4510, credit: false },
      { date: "2026-10-06", amountCents: 150000, credit: true },
    ]);
  });
});

describe("a Débit / Crédit statement read from a real PDF", () => {
  it("finds every line, the right column, and the printed totals", async () => {
    const pdf = await fakeStatementPdf();
    const parsed = parseStatement(await readPdfItems(new Uint8Array(pdf)), new Date("2026-11-14"));
    const debits = parsed.rows.filter((r) => !r.credit);
    const credits = parsed.rows.filter((r) => r.credit);

    expect(debits).toHaveLength(6);
    expect(credits).toHaveLength(2);
    expect(debits.reduce((s, r) => s + r.amountCents, 0)).toBe(FAKE_DEBITS_TOTAL_CENTS);
    expect(credits.reduce((s, r) => s + r.amountCents, 0)).toBe(FAKE_CREDITS_TOTAL_CENTS);
    expect(parsed.expectedDebitsCents).toBe(FAKE_DEBITS_TOTAL_CENTS);
    expect(parsed.expectedCreditsCents).toBe(FAKE_CREDITS_TOTAL_CENTS);

    // Card number and card date are cut from the label; a card purchase takes the day it was made.
    expect(debits[0]).toMatchObject({ label: "Carrefour City Lyon", kind: "carte", date: "2026-10-03" });
    // Detail lines are kept (cleaned of references) to help classify.
    expect(debits.find((r) => r.label === "Web Jean Martin")?.detail).toContain("Loyer");
    expect(debits.find((r) => r.label === "Canal+ France")?.detail).not.toMatch(/FR90ZZZ|Core/);
  });
});

describe("categorize", () => {
  const none = new Map<string, string>();
  it("knows common merchants", () => {
    expect(categorize("Carrefour City Besan", "", none)).toEqual({ category: "courses", source: "rule" });
    expect(categorize("La Boucherie Miserey", "", none).category).toBe("restaurants");
    expect(categorize("Boucherie Bonfil", "", none).category).toBe("courses");
    expect(categorize("Canal+ France", "", none).category).toBe("abonnements");
    expect(categorize("Engie", "", none).category).toBe("énergie");
    expect(categorize("Web Jean Martin", "Loyer Charges 3 rue", none).category).toBe("logement");
    expect(categorize("Pacifica", "Assurance Habitation", none).category).toBe("assurances");
    expect(categorize("Quelque chose d'inconnu", "", none)).toEqual({ category: "divers", source: "default" });
  });

  it("prefers what the family decided before", () => {
    const learned = new Map([[labelKey("Carrefour City Besan"), "loisirs"]]);
    expect(categorize("Carrefour City Besan 17/10", "", learned)).toEqual({ category: "loisirs", source: "learned" });
  });

  it("flags fixed monthly expenses, not shopping", () => {
    expect(looksRecurring("prlv", "abonnements", "Canal+ France", "")).toBe(true);
    expect(looksRecurring("virement", "logement", "Web Jean Martin", "Loyer Charges")).toBe(true);
    expect(looksRecurring("carte", "courses", "Carrefour", "")).toBe(false);
    expect(looksRecurring("carte", "abonnements", "Adobe", "")).toBe(false);
  });
});
