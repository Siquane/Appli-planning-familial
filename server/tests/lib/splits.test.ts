import { describe, expect, it } from "vitest";
import { balances, computeShares, settleUp, SplitError } from "../../src/lib/splits";

const amounts = (r: { amountCents: number }[]) => r.map((x) => x.amountCents);

describe("Comptes partagés — répartition", () => {
  it("partage à parts égales au centime près", () => {
    const r = computeShares(1000, "equal", [{ participantId: "a", value: 0 }, { participantId: "b", value: 0 }, { participantId: "c", value: 0 }]);
    expect(amounts(r)).toEqual([334, 333, 333]);
    expect(amounts(r).reduce((x, y) => x + y)).toBe(1000);
  });

  it("partage en pourcentages, qui doivent faire 100 %", () => {
    expect(amounts(computeShares(10_000, "percent", [{ participantId: "a", value: 6000 }, { participantId: "b", value: 4000 }]))).toEqual([6000, 4000]);
    expect(() => computeShares(10_000, "percent", [{ participantId: "a", value: 6000 }, { participantId: "b", value: 3000 }])).toThrow("90 %");
  });

  it("partage en montants précis, qui doivent faire le total", () => {
    expect(amounts(computeShares(2500, "amount", [{ participantId: "a", value: 2000 }, { participantId: "b", value: 500 }]))).toEqual([2000, 500]);
    expect(() => computeShares(2500, "amount", [{ participantId: "a", value: 2000 }])).toThrow(SplitError);
  });

  it("partage en parts (2 pour un adulte, 1 pour un enfant)", () => {
    expect(amounts(computeShares(5000, "shares", [{ participantId: "adulte", value: 2 }, { participantId: "enfant", value: 1 }, { participantId: "autre", value: 2 }]))).toEqual([2000, 1000, 2000]);
  });

  it("refuse un montant vide ou personne pour partager", () => {
    expect(() => computeShares(0, "equal", [{ participantId: "a", value: 0 }])).toThrow("montant");
    expect(() => computeShares(100, "equal", [])).toThrow("au moins une personne");
  });
});

describe("Comptes partagés — soldes et remboursements", () => {
  it("calcule qui doit quoi et rembourse en un minimum de virements", () => {
    // Anaïs paie 90 € pour 3 ; Marc paie 30 € pour 3.
    const bal = balances(["anais", "marc", "julie"], [
      { paidById: "anais", amountCents: 9000, shares: [{ participantId: "anais", amountCents: 3000 }, { participantId: "marc", amountCents: 3000 }, { participantId: "julie", amountCents: 3000 }] },
      { paidById: "marc", amountCents: 3000, shares: [{ participantId: "anais", amountCents: 1000 }, { participantId: "marc", amountCents: 1000 }, { participantId: "julie", amountCents: 1000 }] },
    ]);
    expect(Object.fromEntries(bal)).toEqual({ anais: 5000, marc: -1000, julie: -4000 });
    expect(settleUp(bal)).toEqual([
      { fromId: "julie", toId: "anais", amountCents: 4000 },
      { fromId: "marc", toId: "anais", amountCents: 1000 },
    ]);
  });

  it("un remboursement remet les compteurs à zéro", () => {
    const bal = balances(["a", "b"], [
      { paidById: "a", amountCents: 2000, shares: [{ participantId: "a", amountCents: 1000 }, { participantId: "b", amountCents: 1000 }] },
      // b rembourse a : une « dépense » payée par b, entièrement pour a.
      { paidById: "b", amountCents: 1000, shares: [{ participantId: "a", amountCents: 1000 }] },
    ]);
    expect(Object.fromEntries(bal)).toEqual({ a: 0, b: 0 });
    expect(settleUp(bal)).toEqual([]);
  });
});
