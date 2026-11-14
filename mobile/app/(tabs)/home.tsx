import { useMemo, useState } from "react";
import { View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { WeekStrip } from "../../src/components/WeekStrip";
import { TaskCard } from "../../src/components/TaskCard";
import { TabHeader } from "../../src/components/PageHeader";
import { TodayCard } from "../../src/components/TodayCard";
import { ReshuffleIcon, CalendarIcon, GiftIcon, PartyIcon, WaveIcon } from "../../src/components/icons";
import { useMembers, useTasks } from "../../src/hooks/useApi";
import { useAuthStore } from "../../src/state/authStore";
import { color, space } from "../../src/theme/tokens";
import { todayWeekday, WEEKDAYS_FULL } from "../../src/lib/weekdays";
import { daysUntilBirthday } from "../../src/lib/notifications";
import type { Weekday } from "../../src/api/types";

const BIRTHDAY_LOOKAHEAD_DAYS = 7;

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  const { data: tasks = [], isLoading, refetch, isRefetching } = useTasks();
  const { data: members = [] } = useMembers();

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.weekday === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [tasks, selected]
  );

  const flexibleCount = tasks.filter((t) => t.flexible).length;

  const upcomingBirthday = useMemo(() => {
    return members
      .filter((m) => m.birthday)
      .map((m) => ({ member: m, days: daysUntilBirthday(m.birthday!) }))
      .filter((b) => b.days <= BIRTHDAY_LOOKAHEAD_DAYS)
      .sort((a, b) => a.days - b.days)[0];
  }, [members]);

  return (
    <Screen techGrid style={{ gap: space.xl }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.accent} />}>
      <TabHeader
        title="Planning"
        subtitle={user?.name?.trim() ? `Salut, ${user.name.trim().split(" ")[0]}` : "Salut"}
        subtitleIcon={<WaveIcon size={15} color={color.accent400} />}
      />

      <TodayCard />

      <WeekStrip selected={selected} onSelect={setSelected} today={today} />

      {upcomingBirthday && (
        <Card row style={{ alignItems: "center", backgroundColor: color.accent900 }}>
          {upcomingBirthday.days === 0 ? <PartyIcon size={18} color={color.accent200} /> : <GiftIcon size={16} color={color.accent200} />}
          <Text size={13} style={{ flex: 1, marginLeft: space.sm }}>
            {upcomingBirthday.days === 0
              ? `C'est l'anniversaire de ${upcomingBirthday.member.name} aujourd'hui !`
              : `Anniversaire de ${upcomingBirthday.member.name} dans ${upcomingBirthday.days} jour${upcomingBirthday.days > 1 ? "s" : ""}`}
          </Text>
          <Button label="Voir" variant="ghost" onPress={() => router.push("/birthdays")} />
        </Card>
      )}

      {flexibleCount > 0 && (
        <Card row style={{ alignItems: "center", backgroundColor: color.accent900 }}>
          <ReshuffleIcon size={16} color={color.accent200} />
          <Text size={13} style={{ flex: 1, marginLeft: space.sm }}>
            {flexibleCount} tâche{flexibleCount > 1 ? "s" : ""} flexible{flexibleCount > 1 ? "s" : ""} — Passerelle peut réajuster ta semaine.
          </Text>
          <Button label="Replanifier" variant="ghost" onPress={() => router.push("/replan")} />
        </Card>
      )}

      <View style={{ gap: space.sm }}>
        <Text weight="medium" size={15} tone="muted">
          {WEEKDAYS_FULL[selected]}
        </Text>
        {!isLoading && dayTasks.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space.lg }}>
            <CalendarIcon size={26} color={color.neutral600} />
            <Text tone="muted" size={13} center>
              Rien de prévu ce jour-là.
            </Text>
          </Card>
        )}
        {dayTasks.map((task) => (
          <TaskCard key={task.id} task={task} members={members} />
        ))}
      </View>
    </Screen>
  );
}
