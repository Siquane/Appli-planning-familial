import { findMe, mySide, previewShares } from "../splits";
import { formatEuros } from "../money";
import type { SplitGroup } from "../../api/types";

const group = (balances: [string, number][], transfers: SplitGroup["transfers"] = []): SplitGroup => ({
  id: "g",
  name: "Vacances",
  emoji: "🏖️",
  defaultSplit: null,
  archived: false,
  spentCents: 0,
  expenseCount: 0,
  lastActivity: "",
  participants: balances.map(([id]) => ({ id, name: id, memberId: null, used: true })),
  balances: balances.map(([participantId, cents]) => ({ participantId, cents })),
  transfers,
});

describe("comptes partagés (appli)", () => {
  it("retrouve « moi » par mon prénom ou mon membre", () => {
    const ps = [{ id: "1", name: "Anaïs", memberId: null, used: false }, { id: "2", name: "Léo", memberId: "m2", used: false }];
    expect(findMe(ps, { name: "Anaïs Dupont" })?.id).toBe("1");
    expect(findMe(ps, { name: "x", memberId: "m2" })?.id).toBe("2");
    expect(findMe(ps, { name: "Marc" })).toBeNull();
  });

  it("résume où j'en suis, ou le premier remboursement", () => {
    expect(mySide(group([["Anaïs", 4000], ["Marc", -4000]]), { name: "Anaïs" })).toEqual({ text: `On te doit ${formatEuros(4000)}`, tone: "plus" });
    expect(mySide(group([["Anaïs", 4000], ["Marc", -4000]]), { name: "Marc" }).text).toBe(`Tu dois ${formatEuros(4000)}`);
    expect(mySide(group([["A", 0], ["B", 0]]), null).text).toBe("Tout le monde est à l'équilibre");
    expect(mySide(group([["A", 500], ["B", -500]], [{ fromId: "B", toId: "A", amountCents: 500 }]), null).text).toBe(`B doit ${formatEuros(500)} à A`);
  });

  it("prévisualise les parts et dit ce qui ne va pas", () => {
    expect(previewShares(1000, "equal", [0, 0, 0]).amounts).toEqual([334, 333, 333]);
    expect(previewShares(1000, "percent", [5000, 4000]).problem).toContain("90 %");
    expect(previewShares(5000, "shares", [2, 1, 2]).amounts).toEqual([2000, 1000, 2000]);
    expect(previewShares(2500, "amount", [2000, 500]).problem).toBeNull();
  });
});
