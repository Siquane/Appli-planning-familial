import { api } from "../api/client";
import type { User } from "../api/types";
import { useAuthStore } from "../state/authStore";
import { clearQueryCache } from "./queryClient";

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

/** Ce qui confirme la suppression : le mot de passe, ou un code reçu par e-mail. */
export type DeleteProof = { password: string } | { emailCode: string };

/**
 * Delete the account and all its data (password or e-mail code confirms it).
 * Signs out on success so the app returns to the login screen with nothing cached.
 */
export async function deleteAccount(proof: DeleteProof, confirmFamily = false, heirId?: string): Promise<void> {
  await api.delete<void>("/auth/me", { ...proof, ...(confirmFamily ? { confirmFamily: true } : {}), ...(heirId ? { heirId } : {}) });
  await useAuthStore.getState().signOut();
}

/** Envoie un code à 6 chiffres à l'adresse du compte (pour un compte sans mot de passe). */
export async function sendDeleteCode(email: string): Promise<void> {
  await api.post<{ ok: boolean }>("/auth/email-code", { email, app: "passerelle" });
}

/**
 * Join a family with a code from an account that already exists. When the account holds
 * information, the server asks first (`account_not_empty`); `erase` confirms with the password.
 */
export async function joinFamily(code: string, erase?: { password: string }): Promise<void> {
  const { user } = await api.post<{ user: User }>("/family/join", { code: code.trim(), ...(erase ? { erase: true, password: erase.password } : {}) });
  // What the screens cached belonged to the old, separate account.
  await clearQueryCache();
  await useAuthStore.getState().setUser(user);
}

/** Leave the family this account joined: from now on it is its own family, without the shared data. */
export async function leaveFamily(): Promise<void> {
  await api.post<void>("/family/leave");
  await clearQueryCache();
  await syncUser();
}
