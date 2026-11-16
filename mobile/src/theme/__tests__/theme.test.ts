jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn() }));
import { activeScheme, applyTheme, color, darkColor, gradient, tint } from "../tokens";
import { storedScheme } from "../../state/themeStore";

describe("storedScheme", () => {
  it("stays dark unless light was chosen", () => {
    expect(storedScheme(null)).toBe("dark");
    expect(storedScheme("dark")).toBe("dark");
    expect(storedScheme("system")).toBe("dark");
    expect(storedScheme("light")).toBe("light");
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
