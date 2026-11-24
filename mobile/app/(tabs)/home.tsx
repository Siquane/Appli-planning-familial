import { useEffect, useMemo, useState } from "react";
import { View, RefreshControl, ScrollView } from "react-native";
import { Chip } from "../../src/components/Chip";
import { usePlanningFilterStore } from "../../src/state/planningFilterStore";
import { TASK_CATEGORIES, filterByCategories, filterByMembers, isCheckable, toggleMember } from "../../src/lib/planningFilter";
import { router } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { WeekStrip } from "../../src/components/WeekStrip";
import { TaskCard } from "../../src/components/TaskCard";
import { TabHeader } from "../../src/components/PageHeader";
import { TodayCard } from "../../src/components/TodayCard";
import { ChevronLeftIcon, ChevronRightIcon, RecurringIcon, ReshuffleIcon, GiftIcon, PartyIcon, WaveIcon } from "../../src/components/icons";
import { shiftWeek, shortDate, tasksOn, weekRange, weekTitle } from "../../src/lib/appointments";
import { useMembers, useTaskDone, useTasks, useToggleTaskDone } from "../../src/hooks/useApi";
import { DayRing, EmptyState } from "../../src/components/Playful";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { weekKey } from "../../src/lib/stars";
import { useAuthStore } from "../../src/state/authStore";
import { color, space } from "../../src/theme/tokens";
import { dayOfWeek, progressLine, todayWeekday, WEEKDAYS_FULL } from "../../src/lib/weekdays";
import { daysUntilBirthday } from "../../src/lib/notifications";
import type { Weekday } from "../../src/api/types";
import { de } from "../../src/lib/elision";

const BIRTHDAY_LOOKAHEAD_DAYS = 7;

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  // 0 = cette semaine, 1 = la suivante, -1 = la précédente…
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeek = weekKey();
  const week = shiftWeek(currentWeek, weekOffset);
  const isCurrentWeek = weekOffset === 0;
  const { data: tasks = [], isLoading, refetch, isRefetching } = useTasks();
  const { data: members = [] } = useMembers();

  // Semaine type (chaque semaine) + rendez-vous datés de cette semaine.
  // Filtre par membre (gardé sur ce téléphone) : ses tâches + celles de toute la famille,
  // et par catégorie ; les deux se combinent.
  const filterIds = usePlanningFilterStore((s) => s.memberIds);
  const setFilterIds = usePlanningFilterStore((s) => s.setMemberIds);
  const filterCategories = usePlanningFilterStore((s) => s.categories);
  const setFilterCategories = usePlanningFilterStore((s) => s.setCategories);
  const activeCategories = filterCategories.filter((c) => (TASK_CATEGORIES as string[]).includes(c));
  const hydrateFilter = usePlanningFilterStore((s) => s.hydrate);
  useEffect(() => {
    hydrateFilter();
  }, [hydrateFilter]);
  const memberIdsAll = useMemo(() => members.map((m) => m.id), [members]);
  const activeFilter = filterIds.filter((id) => memberIdsAll.includes(id));
  const dayTasks = useMemo(
    () => filterByCategories(filterByMembers(tasksOn(tasks, selected, week), filterIds, memberIdsAll), filterCategories),
    [tasks, selected, week, filterIds, memberIdsAll, filterCategories]
  );

  function goToWeek(offset: number) {
    setWeekOffset(offset);
    if (offset === 0) setSelected(today);
  }

  // Coches « fait » de la semaine affichée.
  const day = dayOfWeek(week, selected);
  const { data: doneMarks = [] } = useTaskDone(week);
  const toggleDone = useToggleTaskDone(week);
  const doneIds = useMemo(() => new Set(doneMarks.filter((m) => m.day === day).map((m) => m.taskId)), [doneMarks, day]);
  // École et Travail ne se cochent pas : l'anneau ne compte que le reste.
  const checkable = useMemo(() => dayTasks.filter(isCheckable), [dayTasks]);
  const doneCount = checkable.filter((t) => doneIds.has(t.id)).length;
  const progress = progressLine(doneCount, checkable.length);

  function onToggle(taskId: string) {
    const done = !doneIds.has(taskId);
    // Dernière tâche du jour cochée : petite célébration.
    if (done && doneCount + 1 === checkable.length) useToastStore.getState().show(selected === today && isCurrentWeek ? "Tout est fait pour aujourd'hui, bravo la famille !" : "Tout est fait pour ce jour-là, bravo !", "party");
    toggleDone.mutate({ taskId, day, done }, { onError: (e) => useToastStore.getState().show(errorText(e, "enregistrer la tâche")) });
  }

  // Les tâches déjà faites cette semaine ne se replanifient plus (le serveur les écarte aussi).
  const flexibleCount = tasks.filter((t) => t.flexible && !(isCurrentWeek && doneMarks.some((m) => m.taskId === t.id))).length;

  const upcomingBirthday = useMemo(() => {
    return members
      .filter((m) => m.birthday)
      .map((m) => ({ member: m, days: daysUntilBirthday(m.birthday!) }))
      .filter((b) => b.days <= BIRTHDAY_LOOKAHEAD_DAYS)
      .sort((a, b) => a.days - b.days)[0];
  }, [members]);

  return (
    <Screen techGrid edges={["top"]} style={{ gap: space.xl }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.accent} />}>
      <TabHeader
        title="Planning"
        subtitle={user?.name?.trim() ? `Salut, ${user.name.trim().split(" ")[0]}` : "Salut"}
        subtitleIcon={<WaveIcon size={20} color={color.accent400} />}
      />

      <TodayCard />

      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pressable onPress={() => goToWeek(weekOffset - 1)} accessibilityRole="button" accessibilityLabel="Semaine précédente" hitSlop={10} style={{ padding: space.xs }}>
            <ChevronLeftIcon size={18} color={color.neutral400} />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text weight="medium" size={15}>
              {weekTitle(week, currentWeek)}
            </Text>
            <Text size={11} tone="faint">
              {weekRange(week)}
            </Text>
          </View>
          <Pressable onPress={() => goToWeek(weekOffset + 1)} accessibilityRole="button" accessibilityLabel="Semaine suivante" hitSlop={10} style={{ padding: space.xs }}>
            <ChevronRightIcon size={18} color={color.neutral400} />
          </Pressable>
        </View>
        <WeekStrip selected={selected} onSelect={setSelected} today={isCurrentWeek ? today : null} week={week} />
        {members.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <Chip label="Tous" selected={activeFilter.length === 0} onPress={() => setFilterIds([])} size="sm" />
            {members.map((m) => (
              <Chip key={m.id} label={m.name} selected={activeFilter.includes(m.id)} onPress={() => setFilterIds(toggleMember(activeFilter, m.id, memberIdsAll))} size="sm" />
            ))}
          </ScrollView>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          <Chip label="Toutes" selected={activeCategories.length === 0} onPress={() => setFilterCategories([])} size="sm" />
          {TASK_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={activeCategories.includes(c)} onPress={() => setFilterCategories(toggleMember(activeCategories, c, TASK_CATEGORIES))} size="sm" />
          ))}
        </ScrollView>
        {!isCurrentWeek && (
          <Pressable onPress={() => goToWeek(0)} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: space.xs }}>
            <Text size={13} tone="accent">
              Revenir à cette semaine
            </Text>
          </Pressable>
        )}
      </View>

      <Pressable onPress={() => router.push("/tasks")} accessibilityRole="button">
        <Card row style={{ alignItems: "center" }}>
          <RecurringIcon size={16} color={color.accent400} />
          <Text size={15} weight="medium" style={{ flex: 1, marginLeft: space.sm }}>
            Toutes les tâches
          </Text>
          <Text size={11} tone="faint" style={{ marginRight: space.sm }}>
            {tasks.length}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      {upcomingBirthday && (
        <Card row style={{ alignItems: "center", backgroundColor: color.accent900 }}>
          {upcomingBirthday.days === 0 ? <PartyIcon size={18} color={color.accent200} /> : <GiftIcon size={16} color={color.accent200} />}
          <Text size={13} style={{ flex: 1, marginLeft: space.sm }}>
            {upcomingBirthday.days === 0
              ? `C'est l'anniversaire ${de(upcomingBirthday.member.name)} aujourd'hui !`
              : `Anniversaire ${de(upcomingBirthday.member.name)} dans ${upcomingBirthday.days} jour${upcomingBirthday.days > 1 ? "s" : ""}`}
          </Text>
          <Button label="Voir" variant="ghost" onPress={() => router.push("/birthdays")} />
        </Card>
      )}

      <View style={{ gap: space.sm }}>
        <Text weight="medium" size={15} tone="muted">
          {WEEKDAYS_FULL[selected]} {shortDate(day)}
        </Text>
        {!isLoading && dayTasks.length === 0 && (
          <Card>
            <EmptyState title="Journée libre" detail="Rien de prévu ce jour-là. Profites-en, ou ajoute une tâche avec le « + »." />
          </Card>
        )}
        {checkable.length > 0 && (
          <Card>
            <DayRing done={doneCount} total={checkable.length} title={progress.title} detail={progress.detail} />
          </Card>
        )}
        {dayTasks.map((task) => (
          <TaskCard key={task.id} task={task} members={members} done={doneIds.has(task.id)} onToggleDone={() => onToggle(task.id)} />
        ))}
      </View>

      {/* Discret, sous la liste : un simple lien vers « Replanifier ». */}
      {flexibleCount > 0 && user?.familyRole !== "child" && (
        <Pressable
          onPress={() => router.push("/replan")}
          accessibilityRole="button"
          accessibilityLabel="Replanifier les tâches flexibles"
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingVertical: space.sm }}
        >
          <ReshuffleIcon size={14} color={color.neutral500} />
          <Text size={13} tone="faint">
            {flexibleCount} tâche{flexibleCount > 1 ? "s" : ""} flexible{flexibleCount > 1 ? "s" : ""} ·{" "}
          </Text>
          <Text size={13} tone="accent">
            Replanifier
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}
