import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { notificationsApi } from "../api/resources";
import { getPushToken, setPushToken } from "./pushToken";

/**
 * Alertes envoyées par le serveur quand un autre compte de la famille modifie
 * le planning, les repas, les courses ou les recettes. Il faut l'autorisation
 * des notifications (déjà demandée à l'accueil) et Firebase dans l'APK : sans
 * lui, Expo ne fournit pas de jeton et on ne fait rien.
 */
export const FAMILY_CHANNEL = "family";

// Seuls ces écrans peuvent être ouverts depuis une notification.
const ALLOWED = /^\/((home|budget|repas)(\?tab=(menu|courses|recettes))?|comptes\/[A-Za-z0-9_-]{1,40})$/;

export function alertRoute(data: unknown): string | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && ALLOWED.test(url) ? url : null;
}

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return null;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(FAMILY_CHANNEL, {
        name: "Modifications de la famille",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (token !== getPushToken()) {
      await notificationsApi.savePushToken(token);
      setPushToken(token);
    }
    return token;
  } catch {
    // Pas de Firebase dans cet APK, pas de réseau… : on réessaiera au prochain retour dans l'appli.
    return null;
  }
}
