import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";

// Cached data must outlive the persisted copy, or restored entries would be
// garbage-collected right away.
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: ONE_WEEK },
  },
});

export const CACHE_STORAGE_KEY = "passerelle-query-cache";

// Keeps the last known data on the phone, so the planning, recipes, budget…
// show instantly at launch (even while the free Render server wakes up, or
// offline) and are refreshed in the background.
export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: CACHE_STORAGE_KEY, throttleTime: 2000 }),
  maxAge: ONE_WEEK,
  // Bump when cached data shapes change, so an old cache is dropped instead of misread.
  buster: "v1",
  dehydrateOptions: {
    // Documents carry signed file links that expire after an hour: never keep them.
    shouldDehydrateQuery: (query) => query.state.status === "success" && query.queryKey[0] !== "documents",
  },
};

/** On sign-out: forget everything, in memory and on the phone. */
export async function clearQueryCache() {
  queryClient.clear();
  await AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
}
