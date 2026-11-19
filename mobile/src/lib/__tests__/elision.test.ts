import { de } from "../elision";

describe("de", () => {
  it("elides before a vowel, accents included", () => {
    expect(de("Léo")).toBe("de Léo");
    expect(de("Anaïs")).toBe("d'Anaïs");
    expect(de("Élise")).toBe("d'Élise");
    expect(de("emma")).toBe("d'emma");
    expect(de("Hugo")).toBe("de Hugo");
  });
});
