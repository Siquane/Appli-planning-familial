import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Filtre du Planning par membre de la famille, gardé sur ce téléphone
// (sur le téléphone d'un enfant, il retrouve directement son planning).
// Liste vide = tout le monde.
const KEY = "passerelle-planning-filter";

interface PlanningFilterState {
  memberIds: string[];
  hydrate: () => Promise<void>;
  setMemberIds: (ids: string[]) => void;
}

export const usePlanningFilterStore = create<PlanningFilterState>((set) => ({
  memberIds: [],
  hydrate: async () => {
    const raw = await AsyncStorage.getItem(KEY).catch(() => null);
    try {
      const ids = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) set({ memberIds: ids.filter((x) => typeof x === "string") });
    } catch {
      // filtre illisible : tout le monde
    }
  },
  setMemberIds: (memberIds) => {
    set({ memberIds });
    AsyncStorage.setItem(KEY, JSON.stringify(memberIds)).catch(() => {});
  },
}));
