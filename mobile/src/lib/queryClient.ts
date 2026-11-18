import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { QueryClient, focusManager } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { useOutboxStore } from "../state/outboxStore";
import { PRIVATE_QUERY_KEYS, useChildSpaceStore } from "../state/childSpaceStore";

// Cached data must outlive the persisted copy, or restored entries would be
// garbage-collected right away.
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, gcTime: ONE_WEEK },
  },
});

// On a phone there is no « window focus »: tell React Query when the app comes
// back to the front, so what the other accounts of the family changed shows up
// right away instead of waiting for the next minute.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

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
    // Pendant « Espace de Jules », le budget de l'enfant ne doit pas rester sur le téléphone à la place du sien.
    shouldDehydrateQuery: (query) =>
      query.state.status === "success" &&
      query.queryKey[0] !== "documents" &&
      !(useChildSpaceStore.getState().memberId && PRIVATE_QUERY_KEYS.includes(String(query.queryKey[0]))),
  },
};

/** On sign-out: forget everything, in memory and on the phone. */
export async function clearQueryCache() {
  useChildSpaceStore.getState().set(null);
  queryClient.clear();
  // Changes still waiting belong to the account that is leaving.
  await useOutboxStore.getState().clear();
  await AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
}
