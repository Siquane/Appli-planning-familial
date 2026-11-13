import { useEffect } from "react";
import { router, Tabs } from "expo-router";
import { CustomTabBar } from "../../src/components/CustomTabBar";
import { useMembers, useTasks } from "../../src/hooks/useApi";
import { syncBirthdayReminders, syncEveningDigest, syncTaskReminders } from "../../src/lib/notifications";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useWidgetSync } from "../../src/widgets/sync";
import { takeWidgetRoute } from "../../src/widgets/links";
import { syncUser } from "../../src/lib/account";

export default function TabsLayout() {
  const { data: tasks } = useTasks();
  const { data: members } = useMembers();
  useWidgetSync();

  // Opened from a widget while the app was closed: the start-up redirect
  // lands on Planning, so go on to the screen the widget asked for.
  useEffect(() => {
    const route = takeWidgetRoute();
    if (route && route !== "/home") router.navigate(route as never);
    // Keep the name/initials in step with the server.
    syncUser();
  }, []);

  useEffect(() => {
    if (tasks) syncTaskReminders(tasks);
  }, [tasks]);

  useEffect(() => {
    if (members) syncBirthdayReminders(members);
  }, [members]);

  const digestHydrated = useSettingsStore((s) => s.hydrated);
  const eveningDigest = useSettingsStore((s) => s.eveningDigest);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);
  useEffect(() => {
    if (tasks && digestHydrated) syncEveningDigest(tasks, eveningDigest);
  }, [tasks, digestHydrated, eveningDigest]);

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Planning" }} />
      <Tabs.Screen name="repas" options={{ title: "Repas" }} />
      <Tabs.Screen name="budget" options={{ title: "Budget" }} />
      <Tabs.Screen name="famille" options={{ title: "Famille" }} />
    </Tabs>
  );
}
