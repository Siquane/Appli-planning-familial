jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn() }));
import { accountIsSetUp } from "../onboardingStore";

describe("accountIsSetUp", () => {
  it("skips the welcome screens for an account that is already set up", () => {
    expect(accountIsSetUp({ familyRole: "owner", members: 3, tasks: 0 })).toBe(true);
    expect(accountIsSetUp({ familyRole: "owner", members: 0, tasks: 2 })).toBe(true);
    expect(accountIsSetUp({ familyRole: "planning", members: 0, tasks: 0 })).toBe(true);
    expect(accountIsSetUp({ familyRole: "full", members: 0, tasks: 0 })).toBe(true);
  });

  it("shows them to a brand-new account", () => {
    expect(accountIsSetUp({ familyRole: "owner", members: 0, tasks: 0 })).toBe(false);
    expect(accountIsSetUp({ members: 0, tasks: 0 })).toBe(false);
  });
});
