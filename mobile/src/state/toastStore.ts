import { create } from "zustand";

/** Optional drawn icon shown before the message (in place of an emoji). */
export type ToastIcon = "party" | "sparkle" | "warning";

interface ToastState {
  message: string | null;
  icon: ToastIcon | null;
  show: (message: string, icon?: ToastIcon) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  icon: null,
  show: (message, icon) => set({ message, icon: icon ?? null }),
  hide: () => set({ message: null, icon: null }),
}));
