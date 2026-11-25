import { describe, expect, it } from "vitest";
import { islandOf, islandsOf, SPOTS } from "../../src/lib/cervelle/islands";
import { SHOP, onSale } from "../../src/lib/cervelle/shop";
import { howToGet } from "../../src/lib/cervelle/howToGet";
import { BADGE_LABELS } from "../../src/lib/cervelle/badges";

describe("Cervelle — carte au trésor", () => {
  it("puts each subject on its island", () => {
    expect(islandOf("Mathématiques")).toBe("maths");
    expect(islandOf("Géométrie")).toBe("maths");
    expect(islandOf("Histoire-géo")).toBe("histoire");
    expect(islandOf("Français")).toBe("francais");
    expect(islandOf("SVT")).toBe("sciences");
    expect(islandOf("Anglais")).toBe("langues");
    expect(islandOf("Arts plastiques")).toBe("talents");
    expect(islandOf("", "Les fractions en maths")).toBe("maths");
    expect(islandOf("Cuisine")).toBe("mystere");
  });

  it("reveals one spot per notion mastered, in order, up to 12", () => {
    const at = (d: number) => new Date(Date.UTC(2026, 10, d));
    const found = Array.from({ length: 14 }, (_, i) => ({ title: `N${i}`, subject: "Maths", revisionTitle: "Fractions", masteredAt: at(20 - i) }));
    found.push({ title: "Verbe", subject: "Français", revisionTitle: "Conjugaison", masteredAt: at(1) });
    const islands = islandsOf(found);
    const maths = islands.find((i) => i.id === "maths")!;
    expect(maths).toMatchObject({ explored: SPOTS, complete: true, mastered: 14 });
    expect(maths.found[0].title).toBe("N13");
    expect(islands.find((i) => i.id === "francais")).toMatchObject({ explored: 1, complete: false });
  });

  it("has a pirate hat and a decor won on the map, not for sale", () => {
    for (const id of ["chapeau_pirate", "ile_tresor"]) {
      const item = SHOP.find((i) => i.id === id)!;
      expect(item.kind).toBe("tresor");
      expect(onSale(item, "2026-11-25")).toBe(false);
      expect(howToGet(item, "2026-11-25")).toContain("carte au trésor");
    }
    expect(BADGE_LABELS("ile:maths")).toBe("Explorateur : Île des Nombres");
  });
});
