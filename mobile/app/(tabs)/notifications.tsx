import { Pressable, Switch, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { BellIcon } from "../../src/components/icons";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "../../src/hooks/useApi";
import { color, space } from "../../src/theme/tokens";
import { useSettingsStore } from "../../src/state/settingsStore";
import { confirmReminderPermission, DIGEST_HOUR } from "../../src/lib/notifications";

export default function NotificationsScreen() {
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const today = notifications.filter((n) => n.group === "today");
  const week = notifications.filter((n) => n.group === "week");
  const hasUnread = notifications.some((n) => n.unread);
  const eveningDigest = useSettingsStore((st) => st.eveningDigest);
  const setEveningDigest = useSettingsStore((st) => st.setEveningDigest);

  async function toggleDigest(on: boolean) {
    await setEveningDigest(on);
    if (on) await confirmReminderPermission();
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text heading weight="semibold" size={20}>
          Notifications
        </Text>
        {hasUnread && <Button label="Tout marquer lu" variant="ghost" onPress={() => markAllRead.mutate()} />}
      </View>

      <Pressable onPress={() => toggleDigest(!eveningDigest)} accessibilityRole="switch" accessibilityState={{ checked: eveningDigest }}>
        <Card row style={{ alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text size={14} weight="medium">
              Récap du soir
            </Text>
            <Text size={11.5} tone="faint">
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

      {notifications.length === 0 ? (
        <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
          <BellIcon size={26} color={color.neutral600} />
          <Text tone="muted" size={13} center>
            Aucune notification pour le moment.
          </Text>
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
    <View style={{ gap: space[2] }}>
      <Text weight="medium" size={13} tone="muted">
        {title}
      </Text>
      {items.map((n) => (
        <Pressable key={n.id} onPress={() => n.unread && onRead(n.id)}>
          <Card row style={{ alignItems: "center" }}>
            {n.unread && <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.accent }} />}
            <Text size={13.5} style={{ flex: 1, marginLeft: n.unread ? space[2] : 0 }} tone={n.unread ? "text" : "muted"}>
              {n.title}
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
