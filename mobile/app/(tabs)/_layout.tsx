import { Platform } from "react-native";
import { useEffect } from "react";
import { AppState } from "react-native";
import { router, Tabs } from "expo-router";
import { useIsChildAccount } from "../../src/state/authStore";
import { CustomTabBar } from "../../src/components/CustomTabBar";
import { useBirthdays, useMembers, useTasks, usePocketMoney } from "../../src/hooks/useApi";
import { syncBirthdayReminders, syncEveningDigest, syncMorningDigest, syncTaskReminders, syncAppointmentNotifications, syncPocketMoneyNotifications } from "../../src/lib/notifications";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useWidgetSync } from "../../src/widgets/sync";
import { takeWidgetRoute } from "../../src/widgets/links";
import { syncUser } from "../../src/lib/account";
import { startOutboxSync } from "../../src/lib/outbox";
import { FamilyNoticeModal } from "../../src/components/FamilyNoticeModal";
import * as Notifications from "expo-notifications";
import { alertRoute, registerPushToken } from "../../src/lib/pushAlerts";
import { queryClient } from "../../src/lib/queryClient";

// Une alerte déjà ouverte ne doit pas rouvrir son écran après une reconnexion.
let handledAlert: string | null = null;

export default function TabsLayout() {
  const isChild = useIsChildAccount();
  const { data: tasks } = useTasks();
  const { data: members } = useMembers();
  useWidgetSync();

  // Opened from a widget while the app was closed: the start-up redirect
  // lands on Planning, so go on to the screen the widget asked for.
  useEffect(() => {
    const route = takeWidgetRoute();
    if (route && route !== "/home") router.navigate(route as never);
    // Keep the name/initials and the family in step with the server (the owner can remove an account).
    syncUser();
    registerPushToken();
    const stopSync = startOutboxSync();
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      syncUser();
      registerPushToken();
    });
    // Appui sur une alerte de la famille : ouvrir l'écran concerné (aussi quand
    // c'est elle qui a lancé l'appli).
    const open = (response: Notifications.NotificationResponse | null) => {
      const route = alertRoute(response?.notification.request.content.data);
      const id = response?.notification.request.identifier ?? null;
      if (!route || id === handledAlert) return;
      handledAlert = id;
      router.navigate(route as never);
    };
    // Pas de notification « d'ouverture » sur le web (version d'essai).
    if (Platform.OS !== "web") open(Notifications.getLastNotificationResponse());
    const tap = Notifications.addNotificationResponseReceivedListener(open);
    // Alerte reçue appli ouverte : les données ont changé, on les recharge.
    const received = Notifications.addNotificationReceivedListener((n) => {
      if (alertRoute(n.request.content.data)) queryClient.invalidateQueries();
    });
    return () => {
      sub.remove();
      tap.remove();
      received.remove();
      stopSync();
    };
  }, []);

  useEffect(() => {
    if (tasks) syncTaskReminders(tasks);
  }, [tasks]);

  const { data: birthdays } = useBirthdays();
  useEffect(() => {
    if (!members) return;
    const left = (g: { memberId: string | null; contactId: string | null }, id: string) => g.memberId === id || g.contactId === id;
    const gifts = birthdays?.gifts.filter((g) => !g.bought) ?? [];
    const people = [
      ...members.filter((m) => !!m.birthday).map((m) => ({ id: m.id, name: m.name, birthday: m.birthday!, giftsLeft: gifts.filter((g) => left(g, m.id)).length })),
      ...(birthdays?.contacts ?? []).map((c) => ({ id: c.id, name: c.name, birthday: `${c.birthday}T12:00:00`, giftsLeft: gifts.filter((g) => left(g, c.id)).length })),
    ];
    syncBirthdayReminders(people, birthdays?.remindDays ?? 0);
  }, [members, birthdays]);

  const digestHydrated = useSettingsStore((s) => s.hydrated);
  const eveningDigest = useSettingsStore((s) => s.eveningDigest);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);
  useEffect(() => {
    if (tasks && digestHydrated) syncEveningDigest(tasks, eveningDigest);
  }, [tasks, digestHydrated, eveningDigest]);
  const morningDigest = useSettingsStore((s) => s.morningDigest);
  const morningTime = useSettingsStore((s) => s.morningTime);
  useEffect(() => {
    if (tasks && digestHydrated) syncMorningDigest(tasks, members ?? [], morningDigest, morningTime);
  }, [tasks, members, digestHydrated, morningDigest, morningTime]);
  useEffect(() => {
    if (tasks && digestHydrated) syncAppointmentNotifications(tasks, members ?? [], { enabled: morningDigest, time: morningTime });
  }, [tasks, members, digestHydrated, morningDigest, morningTime]);

  // Téléphone d'un enfant : notification les jours d'argent de poche.
  const { data: pocketMoney } = usePocketMoney();
  useEffect(() => {
    if (isChild && pocketMoney) syncPocketMoneyNotifications(pocketMoney.rule);
  }, [isChild, pocketMoney]);

  return (
    <>
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Planning" }} />
      {/* Un compte enfant n'a pas l'onglet Repas. */}
      <Tabs.Screen name="repas" options={{ title: "Repas", href: isChild ? null : undefined }} />
      <Tabs.Screen name="budget" options={{ title: "Budget" }} />
      <Tabs.Screen name="famille" options={{ title: "Famille" }} />
    </Tabs>
    <FamilyNoticeModal />
    </>
  );
}
