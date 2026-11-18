import { describe, expect, it } from "vitest";
import { cleanOutfit, equip, onSale, owns, readOutfits, SHOP, shopItem, SLOTS } from "../../src/lib/cervelle/shop";

const item = (id: string) => shopItem(id)!;

describe("Cervelle — boutique", () => {
  it("has unique ids, known slots, and every slot filled", () => {
    expect(new Set(SHOP.map((i) => i.id)).size).toBe(SHOP.length);
    for (const slot of SLOTS) expect(SHOP.some((i) => i.slot === slot)).toBe(true);
    expect(SHOP.filter((i) => i.kind === "badge").every((i) => i.price === 0 && i.badge)).toBe(true);
  });

  it("sells seasonal items only in their season, even over New Year", () => {
    expect(onSale(item("bonnet_noel"), "2026-12-15")).toBe(true);
    expect(onSale(item("bonnet_noel"), "2027-01-04")).toBe(true);
    expect(onSale(item("bonnet_noel"), "2026-11-17")).toBe(false);
    expect(onSale(item("citrouille"), "2026-10-31")).toBe(true);
    expect(onSale(item("casquette"), "2026-07-01")).toBe(true);
    expect(onSale(item("couronne_or"), "2026-07-01")).toBe(false);
  });

  it("unlocks badge items with the badge, any year for a holiday", () => {
    expect(owns(item("couronne_or"), [], ["regulier:2"])).toBe(false);
    expect(owns(item("couronne_or"), [], ["regulier:3"])).toBe(true);
    expect(owns(item("guirlande"), [], ["fete:noel:2026"])).toBe(true);
    expect(owns(item("rose"), [], [])).toBe(true);
  });

  it("keeps one item per slot; pink just clears the colour", () => {
    expect(equip(["casquette", "lunettes"], "toque")).toEqual(["lunettes", "toque"]);
    expect(equip(["bleu", "lunettes"], "rose")).toEqual(["lunettes"]);
    expect(cleanOutfit(["casquette", "toque", "inconnu", "bleu"], ["casquette", "toque"], [])).toEqual(["toque"]);
  });

  it("reads saved outfits safely", () => {
    expect(readOutfits(null)).toEqual([null, null, null]);
    expect(readOutfits([["casquette", 3], null, "x", ["y"]])).toEqual([["casquette"], null, null]);
  });
});
