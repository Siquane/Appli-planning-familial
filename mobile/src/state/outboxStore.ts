import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { enqueueInto, type OutboxItem } from "../lib/outboxQueue";

export const OUTBOX_KEY = "passerelle-outbox";

interface OutboxState {
  items: OutboxItem[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  enqueue: (item: OutboxItem) => void;
  /** Replace the whole line (after a change was sent, or dropped). */
  setItems: (items: OutboxItem[]) => void;
  clear: () => Promise<void>;
}

const save = (items: OutboxItem[]) => AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items)).catch(() => {});

// The changes made without a connection, kept on the phone until they are sent.
export const useOutboxStore = create<OutboxState>((set, get) => ({
  items: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(OUTBOX_KEY);
      const stored = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
      // Whatever was queued before the app finished loading goes after what was stored.
      set({ items: [...stored, ...get().items], hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  enqueue: (item) => {
    const items = enqueueInto(get().items, item);
    set({ items });
    save(items);
  },
  setItems: (items) => {
    set({ items });
    save(items);
  },
  clear: async () => {
    set({ items: [] });
    await AsyncStorage.removeItem(OUTBOX_KEY).catch(() => {});
  },
}));
