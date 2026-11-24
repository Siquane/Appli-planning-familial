import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { CalendarIcon, ChevronRightIcon, RecurringIcon } from "../src/components/icons";
import { useMembers, useTasks } from "../src/hooks/useApi";
import { dayKey, shortDate } from "../src/lib/appointments";
import { categoryColor, WEEKDAYS_FULL } from "../src/lib/weekdays";
import type { Member, Task } from "../src/api/types";
import { color, gutter, space } from "../src/theme/tokens";

// « Toutes les tâches », ouvert depuis le Planning : la semaine type jour par
// jour, puis les rendez-vous à venir (les passés repliés). Touche une tâche
// pour la modifier, la dupliquer ou la supprimer.

function TaskRow({ task, members, showDate }: { task: Task; members: Member[]; showDate?: boolean }) {
  const names = task.memberIds.map((id) => members.find((m) => m.id === id)?.name).filter((n): n is string => !!n);
  const when = showDate && task.appointmentDate ? `${shortDate(task.appointmentDate)} · ${task.time}` : task.time;
  return (
    <Pressable onPress={() => router.push(`/task/${task.id}`)} accessibilityRole="button" accessibilityLabel={`${task.title}, ${when}${names.length ? `, ${names.join(", ")}` : ""}`}>
      <Card row style={{ alignItems: "center" }}>
        <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: categoryColor(task.category) }} />
        <View style={{ flex: 1, marginLeft: space.sm }}>
          <Text size={15} weight="medium" numberOfLines={1}>
            {task.title}
          </Text>
          <Text size={11} tone="faint" numberOfLines={1}>
            {when} · {task.category}
            {names.length ? ` · ${names.join(", ")}` : ""}
          </Text>
        </View>
        <ChevronRightIcon size={14} color={color.neutral500} />
      </Card>
    </Pressable>
  );
}

export default function AllTasksScreen() {
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const today = dayKey(new Date());

  const { byWeekday, upcoming, past } = useMemo(() => {
    const mine = memberId ? tasks.filter((t) => t.memberIds.includes(memberId)) : tasks;
    const weekly = mine.filter((t) => !t.appointmentDate);
    const dated = mine.filter((t) => !!t.appointmentDate).sort((a, b) => a.appointmentDate!.localeCompare(b.appointmentDate!) || a.time.localeCompare(b.time));
    return {
      byWeekday: WEEKDAYS_FULL.map((_, wd) => weekly.filter((t) => t.weekday === wd).sort((a, b) => a.time.localeCompare(b.time))),
      upcoming: dated.filter((t) => t.appointmentDate! >= today),
      past: dated.filter((t) => t.appointmentDate! < today).reverse(),
    };
  }, [tasks, memberId, today]);

  const empty = byWeekday.every((d) => d.length === 0) && upcoming.length === 0 && past.length === 0;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Toutes les tâches" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 80, gap: space.sm }} showsVerticalScrollIndicator={false}>
        <Button label="Nouvelle tâche" variant="primary" block onPress={() => router.push("/task/new")} />

        {members.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs, paddingVertical: space.xs }}>
            <Chip label="Tous" selected={!memberId} onPress={() => setMemberId(null)} size="sm" />
            {members.map((m) => (
              <Chip key={m.id} label={m.name} selected={memberId === m.id} onPress={() => setMemberId(memberId === m.id ? null : m.id)} size="sm" />
            ))}
          </ScrollView>
        )}

        {empty && (
          <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Text tone="muted" size={13} center>
              Aucune tâche pour l'instant.
            </Text>
          </Card>
        )}

        {byWeekday.some((d) => d.length) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.md }}>
            <RecurringIcon size={14} color={color.accent400} />
            <Text weight="semibold" size={15}>
              Chaque semaine
            </Text>
          </View>
        )}
        {byWeekday.map((list, wd) =>
          list.length ? (
            <View key={wd} style={{ gap: space.xs }}>
              <Text size={13} tone="muted" weight="medium" style={{ marginTop: space.xs }}>
                {WEEKDAYS_FULL[wd]}
              </Text>
              {list.map((t) => (
                <TaskRow key={t.id} task={t} members={members} />
              ))}
            </View>
          ) : null,
        )}

        {upcoming.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, marginTop: space.lg }}>
            <CalendarIcon size={14} color={color.accent400} />
            <Text weight="semibold" size={15}>
              Rendez-vous à venir
            </Text>
          </View>
        )}
        {upcoming.map((t) => (
          <TaskRow key={t.id} task={t} members={members} showDate />
        ))}

        {past.length > 0 && (
          <Pressable onPress={() => setShowPast((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPast }} style={{ paddingVertical: space.sm, marginTop: space.md }}>
            <Text size={13} tone="accent">
              {showPast ? "Masquer les rendez-vous passés" : `Voir les rendez-vous passés (${past.length})`}
            </Text>
          </Pressable>
        )}
        {showPast && past.map((t) => <TaskRow key={t.id} task={t} members={members} showDate />)}
      </ScrollView>
    </Screen>
  );
}
