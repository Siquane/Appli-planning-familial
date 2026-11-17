import { Switch, View } from "react-native";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { BackHeader } from "../src/components/PageHeader";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { useFamily, useFamilyAlerts, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useSetFamilyAlerts } from "../src/hooks/useApi";
import { registerPushToken } from "../src/lib/pushAlerts";
import { color, space } from "../src/theme/tokens";
import { useSettingsStore } from "../src/state/settingsStore";
import { confirmReminderPermission, DIGEST_HOUR } from "../src/lib/notifications";
import { EmptyState } from "../src/components/Playful";
import { TimeField } from "../src/components/TimeField";

export default function NotificationsScreen() {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const today = notifications.filter((n) => n.group === "today");
  const week = notifications.filter((n) => n.group === "week");
  const hasUnread = notifications.some((n) => n.unread);
  const eveningDigest = useSettingsStore((st) => st.eveningDigest);
  const setEveningDigest = useSettingsStore((st) => st.setEveningDigest);
  const morningDigest = useSettingsStore((st) => st.morningDigest);
  const setMorningDigest = useSettingsStore((st) => st.setMorningDigest);
  const morningTime = useSettingsStore((st) => st.morningTime);
  const setMorningTime = useSettingsStore((st) => st.setMorningTime);

  async function toggleMorning(on: boolean) {
    await setMorningDigest(on);
    if (on) await confirmReminderPermission();
  }

  // Alertes de la famille : seulement quand d'autres comptes partagent la famille.
  const { data: family } = useFamily();
  const sharedFamily = (family?.accounts.length ?? 0) > 1;
  const { data: familyAlerts = true } = useFamilyAlerts();
  const setFamilyAlerts = useSetFamilyAlerts();

  async function toggleFamilyAlerts(on: boolean) {
    setFamilyAlerts.mutate(on);
    if (on && (await confirmReminderPermission())) registerPushToken();
  }

  async function toggleDigest(on: boolean) {
    await setEveningDigest(on);
    if (on) await confirmReminderPermission();
  }

  return (
    <Screen>
      <BackHeader title="Notifications" right={hasUnread ? <Button label="Tout marquer lu" variant="ghost" onPress={() => markAllRead.mutate()} /> : undefined} />

      <Card style={{ gap: space.sm }}>
        <Pressable onPress={() => toggleMorning(!morningDigest)} accessibilityRole="switch" accessibilityState={{ checked: morningDigest }} style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text size={15} weight="medium">
              Récap du matin
            </Text>
            <Text size={11} tone="faint">
              Chaque matin, toutes les tâches du jour, avec qui les fait.
            </Text>
          </View>
          <Switch
            value={morningDigest}
            onValueChange={toggleMorning}
            trackColor={{ false: color.neutral700, true: color.accent700 }}
            thumbColor={morningDigest ? color.accent300 : color.neutral300}
          />
        </Pressable>
        {morningDigest && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Text size={13} tone="muted" style={{ flex: 1 }}>
              Heure
            </Text>
            <TimeField value={morningTime} onChange={setMorningTime} />
          </View>
        )}
      </Card>

      <Pressable onPress={() => toggleDigest(!eveningDigest)} accessibilityRole="switch" accessibilityState={{ checked: eveningDigest }}>
        <Card row style={{ alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text size={15} weight="medium">
              Récap du soir
            </Text>
            <Text size={11} tone="faint">
              Chaque soir à {DIGEST_HOUR} h, les tâches du lendemain.
            </Text>
          </View>
          <Switch
            value={eveningDigest}
            onValueChange={toggleDigest}
            trackColor={{ false: color.neutral700, true: color.accent700 }}
            thumbColor={eveningDigest ? color.accent300 : color.neutral300}
          />
        </Card>
      </Pressable>

      {sharedFamily && (
        <Pressable onPress={() => toggleFamilyAlerts(!familyAlerts)} accessibilityRole="switch" accessibilityState={{ checked: familyAlerts }}>
          <Card row style={{ alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="medium">
                Modifications de la famille
              </Text>
              <Text size={11} tone="faint">
                Quand quelqu'un d'autre change le planning, les repas, les courses ou les recettes.
              </Text>
            </View>
            <Switch
              value={familyAlerts}
              onValueChange={toggleFamilyAlerts}
              trackColor={{ false: color.neutral700, true: color.accent700 }}
              thumbColor={familyAlerts ? color.accent300 : color.neutral300}
            />
          </Card>
        </Pressable>
      )}

      {notifications.length === 0 ? (
        <Card>
          <EmptyState title="Tout est calme 🌙" detail="Aucune notification pour le moment." />
        </Card>
      ) : (
        <>
          {today.length > 0 && <NotificationGroup title="Aujourd'hui" items={today} onRead={(id) => markRead.mutate(id)} />}
          {week.length > 0 && <NotificationGroup title="Cette semaine" items={week} onRead={(id) => markRead.mutate(id)} />}
        </>
      )}
    </Screen>
  );
}

function NotificationGroup({
  title,
  items,
  onRead,
}: {
  title: string;
  items: { id: string; title: string; unread: boolean }[];
  onRead: (id: string) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text weight="medium" size={13} tone="muted">
        {title}
      </Text>
      {items.map((n) => (
        <Pressable key={n.id} onPress={() => n.unread && onRead(n.id)}>
          <Card row style={{ alignItems: "center" }}>
            {n.unread && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.accent }} />}
            <Text size={13} style={{ flex: 1, marginLeft: n.unread ? space.sm : 0 }} tone={n.unread ? "text" : "muted"}>
              {n.title}
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
