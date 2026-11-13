jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  const api = {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  };
  return { __esModule: true, default: api, ...api };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_STORAGE_KEY, clearQueryCache, persistOptions, queryClient } from "../queryClient";

const shouldKeep = (queryKey: unknown[], status = "success") =>
  persistOptions.dehydrateOptions!.shouldDehydrateQuery!({ queryKey, state: { status } } as never);

describe("persisted cache", () => {
  it("keeps loaded data but never documents (their file links expire)", () => {
    expect(shouldKeep(["tasks"])).toBe(true);
    expect(shouldKeep(["expenses", "2026-11"])).toBe(true);
    expect(shouldKeep(["documents", "library"])).toBe(false);
    expect(shouldKeep(["tasks"], "error")).toBe(false);
  });

  it("wipes memory and phone storage on sign-out", async () => {
    queryClient.setQueryData(["tasks"], [{ id: "t1" }]);
    await AsyncStorage.setItem(CACHE_STORAGE_KEY, "{}");
    await clearQueryCache();
    expect(queryClient.getQueryData(["tasks"])).toBeUndefined();
    expect(await AsyncStorage.getItem(CACHE_STORAGE_KEY)).toBeNull();
  });
});
