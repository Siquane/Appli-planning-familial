import * as Updates from "expo-updates";

// EAS Update: when the app starts, look for a newer version of its screens
// (published by the « EAS Update » workflow) and switch to it right away,
// instead of waiting for the next launch. Does nothing in development, or in
// a build without update support. Failures (offline, server down) are
// ignored: the app keeps running the version it has.
export async function applyPendingUpdate(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}
