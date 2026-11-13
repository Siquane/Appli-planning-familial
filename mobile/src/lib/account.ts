import { api } from "../api/client";
import type { User } from "../api/types";
import { useAuthStore } from "../state/authStore";

/** Change the display name; the « Salut, … » greeting and avatar follow. */
export async function updateName(name: string): Promise<User> {
  const { user } = await api.patch<{ user: User }>("/auth/me", { name: name.trim() });
  await useAuthStore.getState().setUser(user);
  return user;
}

/** Refresh the saved user from the server (e.g. name changed elsewhere). */
export async function syncUser(): Promise<void> {
  try {
    const { user } = await api.get<{ user: User }>("/auth/me");
    await useAuthStore.getState().setUser(user);
  } catch {
    // Offline or server asleep: keep what we have.
  }
}

/**
 * Delete the account and all its data (password confirms it). Signs out on
 * success so the app returns to the login screen with nothing cached.
 */
export async function deleteAccount(password: string): Promise<void> {
  await api.delete<void>("/auth/me", { password });
  await useAuthStore.getState().signOut();
}
