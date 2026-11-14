import { ROLE_LABEL, inviteValidity, joinedSummary, noticeText, shareMessage } from "../family";

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

describe("notice after the family changes hands", () => {
  it("tells the new owner what they got and to take their own subscription", () => {
    const n = noticeText({ kind: "heir", from: "Anaïs" });
    expect(n.title).toBe("Tu gères maintenant la famille");
    expect(n.body).toContain("Anaïs a quitté Passerelle");
    expect(n.body).toContain("ton propre abonnement");
    expect(n.offers).toBe(true);
  });

  it("reassures the others and names who takes over", () => {
    const n = noticeText({ kind: "newOwner", from: "Anaïs", heir: "Marc" });
    expect(n.title).toBe("Marc gère maintenant la famille");
    expect(n.body).toContain("tes données sont intacts");
    expect(n.offers).toBe(false);
  });

  it("keeps the account and private data when nobody could take over", () => {
    const n = noticeText({ kind: "detached", from: "Anaïs" });
    expect(n.body).toContain("ton budget et tes documents personnels sont conservés");
    expect(n.title).not.toMatch(/supprim/i);
  });
});
