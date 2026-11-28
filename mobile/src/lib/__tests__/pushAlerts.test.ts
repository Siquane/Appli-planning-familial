jest.mock("expo-notifications", () => ({}));
jest.mock("expo-constants", () => ({}));
jest.mock("../../api/resources", () => ({ notificationsApi: {} }));
import { alertRoute } from "../pushAlerts";

describe("alertRoute", () => {
  it("opens only the screens a family alert can point to", () => {
    expect(alertRoute({ url: "/home" })).toBe("/home");
    expect(alertRoute({ url: "/repas?tab=courses" })).toBe("/repas?tab=courses");
    expect(alertRoute({ url: "/budget" })).toBe("/budget");
    expect(alertRoute({ url: "/comptes/ckx12ab" })).toBe("/comptes/ckx12ab");
    expect(alertRoute({ url: "/comptes/../documents" })).toBeNull();
    expect(alertRoute({ url: "/cervelle-quiz/ckq1" })).toBe("/cervelle-quiz/ckq1");
    expect(alertRoute({ url: "/stars" })).toBe("/stars");
    expect(alertRoute({ url: "/birthdays" })).toBe("/birthdays");
    expect(alertRoute({ url: "/cervelle-fierte/ckl1?week=2026-11-23" })).toBe("/cervelle-fierte/ckl1?week=2026-11-23");
    expect(alertRoute({ url: "/cervelle-fierte/ckl1?week=x" })).toBeNull();
    expect(alertRoute({ url: "/documents" })).toBeNull();
    expect(alertRoute({ url: "https://exemple.fr" })).toBeNull();
    expect(alertRoute({})).toBeNull();
    expect(alertRoute(null)).toBeNull();
  });
});
