import { ROLE_LABEL, inviteValidity, joinedSummary, shareMessage } from "../family";

const NOW = new Date("2026-11-14T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("family screen texts", () => {
  it("names the roles", () => {
    expect(ROLE_LABEL).toEqual({ owner: "Créateur", full: "Complet", planning: "Planning" });
  });

  it("says how long a code is still valid", () => {
    expect(inviteValidity(inDays(7), NOW)).toBe("valable encore 7 jours");
    expect(inviteValidity(inDays(1), NOW)).toBe("valable encore 1 jour");
    expect(inviteValidity(inDays(0.3), NOW)).toBe("valable encore 1 jour");
    expect(inviteValidity(inDays(-0.1), NOW)).toBe("expiré");
    expect(inviteValidity(inDays(-3), NOW)).toBe("expiré");
  });

  it("writes the invitation with the code and its validity", () => {
    const text = shareMessage("K7F2-9QXA", "Anaïs", inDays(7), NOW);
    expect(text).toContain("K7F2-9QXA");
    expect(text).toContain("Anaïs t'invite");
    expect(text).toContain("valable 7 jours");
    expect(shareMessage("K7F2-9QXA", "Anaïs", inDays(0.2), NOW)).toContain("valable 1 jour)");
  });

  it("tells a joiner what they share", () => {
    expect(joinedSummary("planning", "Anaïs")).toContain("ton budget et tes documents restent à toi");
    expect(joinedSummary("full", "Anaïs")).toContain("budget et documents compris");
    expect(joinedSummary("full", null)).toContain("une famille");
  });
});
