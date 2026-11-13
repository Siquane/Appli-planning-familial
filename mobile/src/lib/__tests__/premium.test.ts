jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
import { router } from "expo-router";
import { ApiError } from "../../api/client";
import { mealQuotaLabel, showApiError } from "../premium";
import { useToastStore } from "../../state/toastStore";

const base = { weeksUsed: 0, rerollsUsed: 0, rerollsLimit: 0, resetsAt: "2026-12-01T00:00:00Z" };

describe("mealQuotaLabel", () => {
  it("describes the trial, the free month and Premium", () => {
    expect(mealQuotaLabel({ ...base, period: "trial", weeksLimit: 4, weeksUsed: 1 })).toBe("3 générations gratuites pendant ton premier mois.");
    expect(mealQuotaLabel({ ...base, period: "free", weeksLimit: 1, weeksUsed: 1 })).toBe("Génération gratuite utilisée ce mois-ci.");
    expect(mealQuotaLabel({ ...base, period: "premium", weeksLimit: 12, weeksUsed: 11 })).toBe("Premium : 1 génération restante ce mois-ci.");
  });
});

describe("showApiError", () => {
  it("opens the Premium screen only for a Premium wall", () => {
    showApiError(new ApiError(403, "Ta génération gratuite du mois est utilisée.", "quota_exceeded"));
    expect(useToastStore.getState().message).toBe("Ta génération gratuite du mois est utilisée.");
    expect(router.push).toHaveBeenCalledWith("/premium");

    (router.push as jest.Mock).mockClear();
    showApiError(new ApiError(500, "Erreur serveur"));
    expect(router.push).not.toHaveBeenCalled();
  });
});
