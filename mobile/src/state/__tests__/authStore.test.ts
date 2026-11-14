jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../authStore";

function jsonResponse(ok: boolean, status: number, body: unknown) {
  return { ok, status, json: async () => body } as Response;
}

const user = { id: "u1", email: "claire@passerelle.test", name: "Claire Dubois", initials: "CD" };

describe("authStore", () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    useAuthStore.setState(initialState, true);
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  it("signIn persists tokens and user via SecureStore and updates state", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(true, 200, { user, accessToken: "access-1", refreshToken: "refresh-1" }));

    await useAuthStore.getState().signIn("claire@passerelle.test", "password123");

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("passerelle.accessToken", "access-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("passerelle.refreshToken", "refresh-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("passerelle.user", JSON.stringify(user));
  });

  it("signIn throws the server's error message and leaves state untouched on failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(false, 401, { error: "Email ou mot de passe incorrect" }));

    await expect(useAuthStore.getState().signIn("claire@passerelle.test", "wrong")).rejects.toThrow("Email ou mot de passe incorrect");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("signOut clears storage and state, and fires a best-effort logout call", async () => {
    useAuthStore.setState({ user, accessToken: "access-1", refreshToken: "refresh-1" });
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(true, 204, {}));

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("passerelle.accessToken");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/logout"), expect.objectContaining({ method: "POST" }));
  });

  it("refresh returns false without throwing when the server rejects the refresh token", async () => {
    useAuthStore.setState({ refreshToken: "stale-refresh" });
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(false, 401, { error: "Invalid refresh token" }));

    await expect(useAuthStore.getState().refresh()).resolves.toBe(false);
  });

  it("concurrent refreshes share one call, so the single-use refresh token is sent only once", async () => {
    useAuthStore.setState({ user, accessToken: "expired", refreshToken: "refresh-1" });
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(true, 200, { user, accessToken: "access-2", refreshToken: "refresh-2" }));

    const results = await Promise.all([useAuthStore.getState().refresh(), useAuthStore.getState().refresh()]);

    expect(results).toEqual([true, true]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().accessToken).toBe("access-2");
  });

  it("refresh returns false immediately when there is no refresh token to send", async () => {
    useAuthStore.setState({ refreshToken: null });
    await expect(useAuthStore.getState().refresh()).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("authStore cold-start retries", () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    useAuthStore.setState(initialState, true);
    global.fetch = jest.fn();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("signUp retries while the server answers 503 or the connection fails, then succeeds", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(false, 503, {}))
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce(jsonResponse(true, 201, { user, accessToken: "access-1", refreshToken: "refresh-1" }));

    const promise = useAuthStore.getState().signUp("claire@passerelle.test", "password123", "Claire Dubois", { age15: true });
    await jest.advanceTimersByTimeAsync(5_000);
    await promise;

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("signUp gives up with a clear message once the deadline is reached", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(false, 502, {}));

    const promise = useAuthStore.getState().signUp("claire@passerelle.test", "password123", "Claire Dubois", { age15: true });
    const assertion = expect(promise).rejects.toThrow("Le serveur ne répond pas");
    await jest.advanceTimersByTimeAsync(65_000);
    await assertion;
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("does not retry a real client error such as an existing account", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(false, 409, { error: "Un compte existe déjà avec cet email" }));

    await expect(useAuthStore.getState().signUp("claire@passerelle.test", "password123", "Claire Dubois", { age15: true })).rejects.toThrow("Un compte existe déjà");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("authStore password reset", () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    useAuthStore.setState(initialState, true);
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  it("requestPasswordReset posts the email and resolves without tokens", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(true, 200, { ok: true }));

    await useAuthStore.getState().requestPasswordReset("claire@passerelle.test");

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/forgot-password"), expect.objectContaining({ method: "POST" }));
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("resetPassword signs the user in with the returned tokens", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(true, 200, { user, accessToken: "access-2", refreshToken: "refresh-2" }));

    await useAuthStore.getState().resetPassword("claire@passerelle.test", "123456", "new-password");

    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().accessToken).toBe("access-2");
  });

  it("resetPassword surfaces the server error for a bad code", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(false, 400, { error: "Code invalide ou expiré" }));

    await expect(useAuthStore.getState().resetPassword("claire@passerelle.test", "000000", "new-password")).rejects.toThrow("Code invalide ou expiré");
    expect(useAuthStore.getState().user).toBeNull();
  });
});
