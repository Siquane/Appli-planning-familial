import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

// Filtre du Planning par membre de la famille, gardé sur ce téléphone
// (sur le téléphone d'un enfant, il retrouve directement son planning).
// Liste vide = tout le monde. Même chose pour les catégories (vide = toutes).
const KEY = "passerelle-planning-filter";
const CATEGORY_KEY = "passerelle-planning-filter-categories";

const strings = (raw: string | null): string[] | null => {
  try {
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null; // filtre illisible : pas de filtre
  }
};

interface PlanningFilterState {
  memberIds: string[];
  hydrate: () => Promise<void>;
  categories: string[];
  setMemberIds: (ids: string[]) => void;
  setCategories: (categories: string[]) => void;
}

export const usePlanningFilterStore = create<PlanningFilterState>((set) => ({
  memberIds: [],
  categories: [],
  hydrate: async () => {
    const [ids, cats] = await Promise.all([AsyncStorage.getItem(KEY).catch(() => null), AsyncStorage.getItem(CATEGORY_KEY).catch(() => null)]);
    set({ memberIds: strings(ids) ?? [], categories: strings(cats) ?? [] });
  },
  setMemberIds: (memberIds) => {
    set({ memberIds });
    AsyncStorage.setItem(KEY, JSON.stringify(memberIds)).catch(() => {});
  },
  setCategories: (categories) => {
    set({ categories });
    AsyncStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)).catch(() => {});
  },
}));
