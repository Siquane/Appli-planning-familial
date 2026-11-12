import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Small per-device preferences (not synced with the server).
const DIGEST_KEY = "passerelle-evening-digest";

interface SettingsState {
  hydrated: boolean;
  /** Evening summary of tomorrow's tasks (on by default). */
  eveningDigest: boolean;
  hydrate: () => Promise<void>;
  setEveningDigest: (on: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hydrated: false,
  eveningDigest: true,
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(DIGEST_KEY).catch(() => null);
    set({ hydrated: true, eveningDigest: stored !== "off" });
  },
  setEveningDigest: async (on) => {
    set({ eveningDigest: on });
    await AsyncStorage.setItem(DIGEST_KEY, on ? "on" : "off").catch(() => {});
  },
}));
