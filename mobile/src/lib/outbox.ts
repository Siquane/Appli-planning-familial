import { AppState } from "react-native";
import { api, ApiError, API_URL, setBeforeRead } from "../api/client";
import { queryClient } from "./queryClient";
import { useNetworkStore } from "../state/networkStore";
import { useOutboxStore } from "../state/outboxStore";
import { useToastStore } from "../state/toastStore";
import { createdId, newTempId, remapTempId, type OutboxEntity, type OutboxItem } from "./outboxQueue";

// Working without a connection.
//
// Reading: the last data is kept on the phone (src/lib/queryClient.ts).
// Writing: a change that gets no answer is shown at once on screen, kept in a
// waiting line on the phone, and sent as soon as the server answers again.
// When two people change the same thing, the change that arrives last wins;
// everything that was added is kept.

const QUERY_KEYS: Record<OutboxEntity, string[]> = {
  tasks: ["tasks"],
  shopping: ["shopping"],
  meals: ["meals"],
  expenses: ["expenses"],
};

export interface Write<T> {
  entity: OutboxEntity;
  method: OutboxItem["method"];
  path: string;
  body?: unknown;
  /** Set for a creation: the temporary id the screen shows meanwhile. */
  tempId?: string;
  foldable?: boolean;
  /** Sends it now. */
  send: () => Promise<T>;
  /** What to answer while it is only queued (the temporary version of the result). */
  queuedResult: () => T;
  /** Shows the change in the cached lists. */
  applyToCache: () => void;
}

/** Sends a change, or queues it when the server can't be reached (or earlier changes are still waiting: order matters). */
export async function writeOrQueue<T>(w: Write<T>): Promise<T> {
  const store = useOutboxStore.getState();
  const queue = () => {
    store.enqueue({ id: newTempId(), method: w.method, path: w.path, body: w.body, entity: w.entity, tempId: w.tempId, foldable: w.foldable, at: Date.now() });
    w.applyToCache();
    return w.queuedResult();
  };
  if (store.items.length > 0) {
    const result = queue();
    void flushOutbox();
    return result;
  }
  try {
    return await w.send();
  } catch (e) {
    if (e instanceof ApiError && e.status === 0) return queue();
    throw e;
  }
}

const send = (item: OutboxItem) => {
  if (item.method === "POST") return api.post<unknown>(item.path, item.body);
  if (item.method === "PATCH") return api.patch<unknown>(item.path, item.body);
  return api.delete<unknown>(item.path, item.body);
};

/** The server turned this change down (it was already deleted, or no longer valid): no use sending it again. */
const isRefused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429;

let flushing: Promise<void> | null = null;

/** Sends the waiting changes in order, stopping at the first one the network can't carry. */
export function flushOutbox(): Promise<void> {
  if (!flushing) flushing = run().finally(() => (flushing = null));
  return flushing;
}

async function run() {
  await useOutboxStore.getState().hydrate();
  const touched = new Set<OutboxEntity>();
  let refused = 0;
  for (;;) {
    const [item, ...rest] = useOutboxStore.getState().items;
    if (!item) break;
    try {
      const result = await send(item);
      const real = item.tempId ? createdId(result) : null;
      useOutboxStore.getState().setItems(item.tempId && real ? remapTempId(rest, item.tempId, real) : rest);
      touched.add(item.entity);
    } catch (e) {
      if (isRefused(e)) {
        useOutboxStore.getState().setItems(rest);
        touched.add(item.entity);
        refused += 1;
        continue;
      }
      break; // Still offline, or the server is struggling: keep the line and try again later.
    }
  }
  for (const entity of touched) await queryClient.invalidateQueries({ queryKey: QUERY_KEYS[entity] });
  if (refused > 0) {
    useToastStore.getState().show(refused === 1 ? "Un changement fait hors connexion n'a pas pu être appliqué (déjà modifié ou supprimé ailleurs)." : `${refused} changements faits hors connexion n'ont pas pu être appliqués (déjà modifiés ou supprimés ailleurs).`);
  }
}

/** Asks the server if it answers, and sends what is waiting when it does. */
export async function checkConnection(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    await fetch(`${API_URL}/health`, { signal: controller.signal });
    useNetworkStore.getState().setOnline(true);
    await flushOutbox();
  } catch {
    useNetworkStore.getState().setOnline(false);
  } finally {
    clearTimeout(timer);
  }
}

const RETRY_EVERY_MS = 15_000;

/** Starts watching the connection: when the app comes back to the front, and every few seconds while changes wait or the phone is offline. */
export function startOutboxSync(): () => void {
  setBeforeRead(() => (useOutboxStore.getState().items.length > 0 ? flushOutbox() : Promise.resolve()));
  void useOutboxStore.getState().hydrate().then(() => {
    if (useOutboxStore.getState().items.length > 0) void checkConnection();
  });
  const sub = AppState.addEventListener("change", (state) => state === "active" && void checkConnection());
  const timer = setInterval(() => {
    if (!useNetworkStore.getState().online || useOutboxStore.getState().items.length > 0) void checkConnection();
  }, RETRY_EVERY_MS);
  return () => {
    sub.remove();
    clearInterval(timer);
    setBeforeRead(null);
  };
}
