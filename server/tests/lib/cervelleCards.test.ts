import { describe, expect, it } from "vitest";
import { CARDS, ODDS, cardsEarned, drawCard } from "../../src/lib/cervelle/cards";

describe("Cervelle — album de cartes", () => {
  it("has 55 animals with a fact, ids unique, three rarities", () => {
    expect(CARDS).toHaveLength(55);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(55);
    for (const c of CARDS) expect(c.fact.length).toBeGreaterThan(20);
    expect(CARDS.filter((c) => c.rarity === "legendaire").length).toBe(7);
    expect(ODDS.commune + ODDS.rare + ODDS.legendaire).toBeCloseTo(1);
  });

  it("draws the rarity first, then a card of that rarity", () => {
    expect(drawCard(() => 0.01).rarity).toBe("legendaire");
    expect(drawCard(() => 0.2).rarity).toBe("rare");
    expect(drawCard(() => 0.9).rarity).toBe("commune");
    expect(drawCard(() => 0.9999).rarity).toBe("commune");
  });

  it("gives 3 welcome cards, then one per notion mastered", () => {
    expect(cardsEarned(0)).toBe(3);
    expect(cardsEarned(4)).toBe(7);
  });
});
