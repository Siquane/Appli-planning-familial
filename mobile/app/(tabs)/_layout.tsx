import { useEffect } from "react";
import { Tabs } from "expo-router";
import { CustomTabBar } from "../../src/components/CustomTabBar";
import { useMembers, useTasks } from "../../src/hooks/useApi";
import { syncBirthdayReminders, syncEveningDigest, syncTaskReminders } from "../../src/lib/notifications";
import { useSettingsStore } from "../../src/state/settingsStore";
import { useWidgetSync } from "../../src/widgets/sync";

export default function TabsLayout() {
  const { data: tasks } = useTasks();
  const { data: members } = useMembers();
  useWidgetSync();

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
