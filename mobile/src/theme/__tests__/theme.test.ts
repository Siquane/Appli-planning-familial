jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { activeScheme, applyTheme, color, darkColor, gradient, tint } from "../tokens";
import { resolveScheme } from "../../state/themeStore";

describe("resolveScheme", () => {
  it("follows the phone unless a theme is forced", () => {
    expect(resolveScheme("system", "light")).toBe("light");
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", null)).toBe("dark");
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });
});

describe("applyTheme", () => {
  afterEach(() => applyTheme("dark"));

  it("swaps the palette in place, and the widgets keep the dark one", () => {
    const bg = color.bg;
    applyTheme("light");
    expect(activeScheme()).toBe("light");
    expect(color.bg).toBe("#f4f8ff");
    expect(color.text).toBe("#0b1530");
    expect(tint.accent.bg).toBe(color.accent800);
    expect(gradient).toHaveLength(3);
    expect(darkColor.bg).toBe(bg);
    applyTheme("dark");
    expect(color.bg).toBe(bg);
  });

  it("gives both palettes the same keys", () => {
    const darkKeys = Object.keys(darkColor).sort();
    applyTheme("light");
    expect(Object.keys(color).sort()).toEqual(darkKeys);
    expect(Object.values(color).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });
});
