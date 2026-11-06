import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Gerät beim Server für Push registrieren (Bestellstatus, neue Touren). Gibt das Token zurück. */
export async function registerForPush(token: string, locale: string): Promise<string | null> {
  if (!Device.isDevice || Platform.OS === "web") return null;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", { name: "default", importance: Notifications.AndroidImportance.DEFAULT });
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const push = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await api("/api/v1/me/push-token", { token, locale, body: { token: push.data, platform: Platform.OS === "ios" ? "ios" : "android" } });
  return push.data;
}

export async function unregisterPush(token: string, pushToken: string) {
  await api(`/api/v1/me/push-token?token=${encodeURIComponent(pushToken)}`, { token, method: "DELETE" }).catch(() => undefined);
}
