import { create } from "zustand";

// Whether the server can be reached, as the last request saw it. No native
// module: a request that gets no answer marks the phone offline, any answer
// marks it online again (see src/lib/outbox.ts for the retry loop).
interface NetworkState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  online: true,
  setOnline: (online) => set((s) => (s.online === online ? s : { online })),
}));

export const useIsOnline = () => useNetworkStore((s) => s.online);
