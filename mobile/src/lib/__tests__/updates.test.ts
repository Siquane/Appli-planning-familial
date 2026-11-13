import * as Updates from "expo-updates";
import { applyPendingUpdate } from "../updates";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(async () => {}),
}));

const U = Updates as jest.Mocked<typeof Updates> & { isEnabled: boolean };

describe("applyPendingUpdate", () => {
  const dev = (global as { __DEV__?: boolean }).__DEV__;
  beforeEach(() => {
    jest.clearAllMocks();
    (global as { __DEV__?: boolean }).__DEV__ = false;
  });
  afterAll(() => {
    (global as { __DEV__?: boolean }).__DEV__ = dev;
  });

  it("downloads and switches to a new version when one is published", async () => {
    U.checkForUpdateAsync.mockResolvedValue({ isAvailable: true } as never);
    U.fetchUpdateAsync.mockResolvedValue({ isNew: true } as never);
    expect(await applyPendingUpdate()).toBe(true);
    expect(U.reloadAsync).toHaveBeenCalled();
  });

  it("keeps the current version when nothing new is available", async () => {
    U.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
    expect(await applyPendingUpdate()).toBe(false);
    expect(U.fetchUpdateAsync).not.toHaveBeenCalled();
    expect(U.reloadAsync).not.toHaveBeenCalled();
  });

  it("ignores network errors", async () => {
    U.checkForUpdateAsync.mockRejectedValue(new Error("offline"));
    expect(await applyPendingUpdate()).toBe(false);
  });

  it("does nothing in development", async () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(await applyPendingUpdate()).toBe(false);
    expect(U.checkForUpdateAsync).not.toHaveBeenCalled();
  });
});
