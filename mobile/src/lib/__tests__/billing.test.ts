jest.mock("react-native-purchases", () => ({ __esModule: true, default: { PURCHASES_ERROR_CODE: {} } }));
import { replacedProduct, type PackPrices } from "../billing";

const pkg = (id: string) => ({ product: { identifier: id } }) as unknown as PackPrices["monthly"];
const prices = {
  budget: { monthly: pkg("budget_monthly:monthly"), annual: pkg("budget_annual:annual") },
  meals: { monthly: pkg("meals_monthly:monthly"), annual: pkg("meals_annual:annual") },
  both: { monthly: pkg("both_monthly:monthly"), annual: pkg("both_annual:annual") },
};

describe("replacedProduct", () => {
  it("replaces a single pack when moving to « Les 2 »", () => {
    expect(replacedProduct("both", "both_monthly:monthly", ["budget_monthly:monthly"], prices)).toBe("budget_monthly");
  });

  it("replaces the same pack when changing period", () => {
    expect(replacedProduct("budget", "budget_annual:annual", ["budget_monthly:monthly"], prices)).toBe("budget_monthly");
  });

  it("adds the other single pack instead of replacing", () => {
    expect(replacedProduct("meals", "meals_monthly:monthly", ["budget_monthly:monthly"], prices)).toBeNull();
  });

  it("does nothing without an active subscription", () => {
    expect(replacedProduct("both", "both_annual:annual", [], prices)).toBeNull();
  });
});
