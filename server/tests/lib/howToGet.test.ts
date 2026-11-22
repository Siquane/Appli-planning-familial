import { describe, expect, it } from "vitest";
import { howToGet } from "../../src/lib/cervelle/howToGet";
import { SHOP } from "../../src/lib/cervelle/shop";
import { themeOf } from "../../src/lib/cervelle/stars";

const item = (id: string) => SHOP.find((i) => i.id === id)!;

describe("Comment l'avoir ?", () => {
  it("says which badge, and what to do for it", () => {
    expect(howToGet(item("couronne_or"), "2026-11-22")).toBe("Gagne le badge « Régulier en or » : réviser 30 jours de suite.");
    expect(howToGet(item("explorateur"), "2026-11-22")).toBe("Gagne le badge « Explorateur en or » : réviser 8 matières différentes.");
  });

  it("explains a holiday badge with its dates", () => {
    expect(howToGet(item("guirlande"), "2026-11-22")).toBe("Gagne le badge « Noël » dans « Tes badges ». Pour ça : réviser pendant les vacances de Noël (20 décembre – 3 janvier).");
  });

  it("tells which month's star path gives the prize", () => {
    const now = themeOf("2026-11");
    expect(howToGet(item(now.item), "2026-11-22")).toContain("cadeau du chemin d'étoiles de ce mois-ci");
    expect(howToGet(item(now.item), "2026-11-22")).toContain("50 étoiles");
    const other = SHOP.find((i) => i.kind === "chemin" && i.id !== now.item)!;
    expect(howToGet(other, "2026-11-22")).toMatch(/chemin d'étoiles de (décembre|janvier|février)/);
  });

  it("says nothing for an item that is simply bought", () => {
    expect(howToGet(item("violet"), "2026-11-22")).toBeNull();
  });

  it("covers every item that cannot be bought", () => {
    for (const i of SHOP.filter((x) => x.kind === "badge" || x.kind === "chemin")) expect(howToGet(i, "2026-11-22")).toBeTruthy();
  });
});
