import { useEffect } from "react";
import { Tabs } from "expo-router";
import { CustomTabBar } from "../../src/components/CustomTabBar";
import { useMembers, useTasks } from "../../src/hooks/useApi";
import { syncBirthdayReminders, syncEveningDigest, syncTaskReminders } from "../../src/lib/notifications";
import { useSettingsStore } from "../../src/state/settingsStore";

export default function TabsLayout() {
  const { data: tasks } = useTasks();
  const { data: members } = useMembers();

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
      <Tabs.Screen name="home" options={{ title: "Accueil" }} />
      <Tabs.Screen name="search" options={{ title: "Recherche" }} />
      <Tabs.Screen name="notifications" options={{ title: "Notifications" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}
