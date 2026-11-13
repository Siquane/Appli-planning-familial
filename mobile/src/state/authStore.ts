import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_URL } from "../api/client";
import type { User } from "../api/types";
import { clearQueryCache } from "../lib/queryClient";
import { refreshWidgets } from "../widgets/refresh";

const ACCESS_KEY = "passerelle.accessToken";
const REFRESH_KEY = "passerelle.refreshToken";
const USER_KEY = "passerelle.user";

// expo-secure-store has no web implementation; the web target (used only for
// quick iteration, not a shipping platform here) falls back to localStorage.
const storage = {
  async get(key: string) {
    if (Platform.OS === "web") return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") return typeof localStorage !== "undefined" ? localStorage.setItem(key, value) : undefined;
    return SecureStore.setItemAsync(key, value);
  },
  async del(key: string) {
    if (Platform.OS === "web") return typeof localStorage !== "undefined" ? localStorage.removeItem(key) : undefined;
    return SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  refresh: () => Promise<boolean>;
  /** Replace the signed-in user (after a rename or a fresh /auth/me). */
  setUser: (user: User) => Promise<void>;
}

async function persist(user: User, accessToken: string, refreshToken: string) {
  await Promise.all([
    storage.set(ACCESS_KEY, accessToken),
    storage.set(REFRESH_KEY, refreshToken),
    storage.set(USER_KEY, JSON.stringify(user)),
  ]);
}

// The API runs on Render's free plan, which puts the server to sleep when idle.
// The first request after a pause can take 30-50s while it boots, and during
// that window Render answers 502/503/504 or the connection fails. We retry
// those transient failures until a global deadline instead of surfacing an
// error on the first attempt.
export const AUTH_DEADLINE_MS = 60_000;
const RETRY_DELAY_MS = 2_000;
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function postWithRetry(path: string, body: unknown): Promise<Record<string, unknown>> {
  const deadline = Date.now() + AUTH_DEADLINE_MS;
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new Error("Le serveur ne répond pas. Vérifie ta connexion et réessaie dans un instant.");
    }

    let res: Response;
    try {
      res = await fetchWithTimeout(`${API_URL}${path}`, init, remaining);
    } catch {
      await wait(Math.min(RETRY_DELAY_MS, Math.max(0, deadline - Date.now())));
      continue;
    }

    if (RETRYABLE_STATUSES.has(res.status)) {
      await wait(Math.min(RETRY_DELAY_MS, Math.max(0, deadline - Date.now())));
      continue;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Une erreur est survenue");
    return data;
  }
}

async function authRequest(path: string, body: unknown) {
  const data = await postWithRetry(path, body);
  if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string" || !data.user) {
    throw new Error("Le serveur met parfois quelques secondes à se réveiller. Réessaie dans un instant.");
  }
  return data as unknown as { user: User; accessToken: string; refreshToken: string };
}

let wakePromise: Promise<void> | null = null;

/**
 * Fire-and-forget ping so the sleeping Render server starts booting while the
 * user is still typing. Called once at app start.
 */
export function wakeServer(): Promise<void> {
  if (!wakePromise) {
    wakePromise = fetchWithTimeout(`${API_URL}/health`, { method: "GET" }, AUTH_DEADLINE_MS)
      .then(() => undefined)
      .catch(() => undefined);
  }
  return wakePromise;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  hydrated: false,

  hydrate: async () => {
    const [accessToken, refreshToken, userRaw] = await Promise.all([
      storage.get(ACCESS_KEY),
      storage.get(REFRESH_KEY),
      storage.get(USER_KEY),
    ]);
    set({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? null,
      user: userRaw ? (JSON.parse(userRaw) as User) : null,
      hydrated: true,
    });
  },

  signUp: async (email, password, name) => {
    const data = await authRequest("/auth/signup", { email, password, name });
    await persist(data.user, data.accessToken, data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },

  signIn: async (email, password) => {
    const data = await authRequest("/auth/login", { email, password });
    await persist(data.user, data.accessToken, data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },

  requestPasswordReset: async (email) => {
    await postWithRetry("/auth/forgot-password", { email });
  },

  resetPassword: async (email, code, password) => {
    const data = await authRequest("/auth/reset-password", { email, code, password });
    await persist(data.user, data.accessToken, data.refreshToken);
    set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },

  signOut: async () => {
    const { refreshToken } = get();
    await Promise.all([storage.del(ACCESS_KEY), storage.del(REFRESH_KEY), storage.del(USER_KEY)]);
    set({ user: null, accessToken: null, refreshToken: null });
    // Never show one account's cached data to the next one.
    await clearQueryCache();
    // …nor on the home-screen widgets.
    await refreshWidgets(null);
    if (refreshToken) {
      fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
  },

  refresh: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return false;
    try {
      const data = await authRequest("/auth/refresh", { refreshToken });
      await persist(data.user, data.accessToken, data.refreshToken);
      set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  setUser: async (user) => {
    if (!get().accessToken) return;
    await storage.set(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));
