import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Small per-device preferences (not synced with the server).
const DIGEST_KEY = "passerelle-evening-digest";
const MORNING_KEY = "passerelle-morning-digest";
const MORNING_TIME_KEY = "passerelle-morning-time";
export const DEFAULT_MORNING_TIME = "09:00";

interface SettingsState {
  hydrated: boolean;
  /** Evening summary of tomorrow's tasks (on by default). */
  eveningDigest: boolean;
  /** Morning summary of today's tasks (on by default), at `morningTime` ("HH:MM"). */
  morningDigest: boolean;
  morningTime: string;
  hydrate: () => Promise<void>;
  setEveningDigest: (on: boolean) => Promise<void>;
  setMorningDigest: (on: boolean) => Promise<void>;
  setMorningTime: (time: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hydrated: false,
  eveningDigest: true,
  morningDigest: true,
  morningTime: DEFAULT_MORNING_TIME,
  hydrate: async () => {
    const [evening, morning, time] = await Promise.all(
      [DIGEST_KEY, MORNING_KEY, MORNING_TIME_KEY].map((k) => AsyncStorage.getItem(k).catch(() => null)),
    );
    set({
      hydrated: true,
      eveningDigest: evening !== "off",
      morningDigest: morning !== "off",
      morningTime: time && /^\d{2}:\d{2}$/.test(time) ? time : DEFAULT_MORNING_TIME,
    });
  },
  setMorningDigest: async (on) => {
    set({ morningDigest: on });
    await AsyncStorage.setItem(MORNING_KEY, on ? "on" : "off").catch(() => {});
  },
  setMorningTime: async (time) => {
    if (!/^\d{2}:\d{2}$/.test(time)) return;
    set({ morningTime: time });
    await AsyncStorage.setItem(MORNING_TIME_KEY, time).catch(() => {});
  },
  setEveningDigest: async (on) => {
    set({ eveningDigest: on });
    await AsyncStorage.setItem(DIGEST_KEY, on ? "on" : "off").catch(() => {});
  },
}));
