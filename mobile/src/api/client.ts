import { Platform } from "react-native";
import { useAuthStore } from "../state/authStore";
import { OFFLINE_MESSAGE, statusMessage } from "../lib/errors";

// EXPO_PUBLIC_API_URL lets a real device/dev-build point at a LAN IP; the
// Android emulator can't reach the host via "localhost" so it gets the
// 10.0.2.2 alias instead.
const DEFAULT_URL = Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_URL;

export class ApiError extends Error {
  status: number;
  /** Machine-readable reason when the server gives one ("premium_required", "quota_exceeded"…). */
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** True when the request was refused because it needs Premium (feature or quota). */
export function needsPremium(e: unknown) {
  return e instanceof ApiError && (e.code === "premium_required" || e.code === "quota_exceeded");
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // No answer at all (offline, server asleep): say so instead of « Network request failed ».
    throw new ApiError(0, OFFLINE_MESSAGE);
  }

  if (res.status === 401 && !accessToken && !useAuthStore.getState().refreshToken) {
    // No session at all: sign out so the app returns to the login screen.
    if (useAuthStore.getState().user) useAuthStore.getState().signOut();
    throw new ApiError(401, "Session expirée, reconnecte-toi.");
  }

  if (res.status === 401 && retry && useAuthStore.getState().refreshToken) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) return request<T>(path, options, false);
    useAuthStore.getState().signOut();
    throw new ApiError(401, statusMessage(401));
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? statusMessage(res.status), typeof body.code === "string" ? body.code : undefined);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) => request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string, data?: unknown) => request<T>(path, { method: "DELETE", body: data !== undefined ? JSON.stringify(data) : undefined }),
};
