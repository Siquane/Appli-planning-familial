import type { StatementRow } from "../../api/types";
import { formatDay, importLabel, importedMessage, initialReview, selectedCount, selectedTotal, toImportPayload } from "../statementImport";

const row = (over: Partial<StatementRow> = {}): StatementRow => ({
  id: 0,
  date: "2026-10-05",
  label: "Carrefour City",
  detail: "",
  kind: "carte",
  amountCents: 7448,
  category: "courses",
  source: "rule",
  duplicate: false,
  recurringHint: false,
  ...over,
});

describe("review of an imported statement", () => {
  it("ticks everything except what is already in the budget, and ticks monthly hints", () => {
    const review = initialReview([row(), row({ id: 1, duplicate: true, recurringHint: true }), row({ id: 2, recurringHint: true })]);
    expect(review.map((r) => r.selected)).toEqual([true, false, true]);
    expect(review.map((r) => r.recurring)).toEqual([false, false, true]);
  });

  it("sends only ticked lines and asks to remember corrected categories", () => {
    const review = initialReview([row(), row({ id: 1, label: "Canal+", category: "abonnements", amountCents: 2299 }), row({ id: 2 })]);
    review[0].category = "loisirs";
    review[2].selected = false;
    expect(toImportPayload(review)).toEqual([
      { date: "2026-10-05", label: "Carrefour City", amountCents: 7448, category: "loisirs", recurring: false, learn: true },
      { date: "2026-10-05", label: "Canal+", amountCents: 2299, category: "abonnements", recurring: false, learn: false },
    ]);
    expect(selectedCount(review)).toBe(2);
    expect(selectedTotal(review)).toBe(7448 + 2299);
  });

  it("formats days and messages in French", () => {
    expect(formatDay("2026-10-05")).toBe("5 oct.");
    expect(formatDay("2026-12-31")).toBe("31 déc.");
    expect(importLabel(0)).toBe("Coche au moins une dépense");
    expect(importLabel(1)).toBe("Importer 1 dépense");
    expect(importLabel(12)).toBe("Importer 12 dépenses");
    expect(importedMessage(1, 0)).toBe("1 dépense ajoutée au budget.");
    expect(importedMessage(12, 2)).toBe("12 dépenses ajoutées au budget. 2 dépenses récurrentes créées.");
  });
});
