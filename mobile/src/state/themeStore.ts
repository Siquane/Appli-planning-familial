import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { Scheme } from "../theme/tokens";

// Thème de l'appli, propre à ce téléphone : suivre le réglage du téléphone
// (par défaut), ou toujours clair, ou toujours sombre.
export type ThemePreference = "system" | "light" | "dark";
const KEY = "passerelle-theme";

interface ThemeState {
  hydrated: boolean;
  preference: ThemePreference;
  hydrate: () => Promise<void>;
  setPreference: (p: ThemePreference) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  hydrated: false,
  preference: "system",
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(KEY).catch(() => null);
    set({ hydrated: true, preference: stored === "light" || stored === "dark" ? stored : "system" });
  },
  setPreference: async (preference) => {
    set({ preference });
    await AsyncStorage.setItem(KEY, preference).catch(() => {});
  },
}));

/** Le thème à afficher, d'après la préférence et le réglage du téléphone. */
export function resolveScheme(preference: ThemePreference, system: string | null | undefined): Scheme {
  if (preference !== "system") return preference;
  return system === "light" ? "light" : "dark";
}
