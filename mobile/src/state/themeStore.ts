import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { Scheme } from "../theme/tokens";

// Thème de l'appli, propre à ce téléphone : sombre par défaut, clair au choix
// dans le profil. Il ne suit pas le réglage du téléphone (choix de l'utilisatrice).
const KEY = "passerelle-theme";

interface ThemeState {
  hydrated: boolean;
  scheme: Scheme;
  hydrate: () => Promise<void>;
  setScheme: (s: Scheme) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  hydrated: false,
  scheme: "dark",
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(KEY).catch(() => null);
    set({ hydrated: true, scheme: storedScheme(stored) });
  },
  setScheme: async (scheme) => {
    set({ scheme });
    await AsyncStorage.setItem(KEY, scheme).catch(() => {});
  },
}));

/** Sombre sauf si « clair » a été choisi. */
export function storedScheme(stored: string | null | undefined): Scheme {
  return stored === "light" ? "light" : "dark";
}
