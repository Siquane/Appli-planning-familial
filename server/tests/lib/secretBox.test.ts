import { describe, expect, it } from "vitest";
import { isSealed, open, seal } from "../../src/lib/secretBox";

describe("secretBox", () => {
  it("seals and opens a secret, each time differently", () => {
    const a = seal("refresh-token-123");
    expect(isSealed(a)).toBe(true);
    expect(a).not.toContain("refresh-token-123");
    expect(seal("refresh-token-123")).not.toBe(a);
    expect(open(a)).toBe("refresh-token-123");
  });

  it("keeps null and reads values stored before encryption", () => {
    expect(seal(null)).toBeNull();
    expect(open("ancien-en-clair")).toBe("ancien-en-clair");
  });

  it("refuses a tampered value", () => {
    const a = seal("secret");
    const tampered = a.slice(0, -4) + (a.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => open(tampered)).toThrow();
  });
});
