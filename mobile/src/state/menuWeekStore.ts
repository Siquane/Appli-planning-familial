import { create } from "zustand";
import { weekKey } from "../lib/stars";
import { shiftWeek } from "../lib/appointments";

// Semaine affichée dans Repas (menu, proposition et courses suivent la même).
// Écart en semaines depuis la semaine en cours ; pas gardé entre deux lancements.
interface MenuWeekState {
  offset: number;
  setOffset: (offset: number) => void;
}

export const useMenuWeekStore = create<MenuWeekState>((set) => ({
  offset: 0,
  setOffset: (offset) => set({ offset }),
}));

/** Le lundi (« AAAA-MM-JJ ») de la semaine de menus affichée. */
export function useMenuWeek(): string {
  const offset = useMenuWeekStore((s) => s.offset);
  return shiftWeek(weekKey(), offset);
}
