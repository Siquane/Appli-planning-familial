import { nextLabel, ruleLabel } from "../pocketMoney";

describe("pocket money texts", () => {
  it("says the rule", () => {
    expect(ruleLabel({ amountCents: 500, frequency: "weekly", day: 5 })).toMatch(/^5,00\s€ chaque samedi$/);
    expect(ruleLabel({ amountCents: 2000, frequency: "monthly", day: 1 })).toMatch(/^20,00\s€ le 1er de chaque mois$/);
    expect(ruleLabel({ amountCents: 2000, frequency: "monthly", day: 15 })).toMatch(/le 15 de chaque mois$/);
    expect(nextLabel({ nextDay: "2026-11-21" })).toBe("Prochain versement : sam. 21 nov.");
  });
});
