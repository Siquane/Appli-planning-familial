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
import { WeekNav } from "../../src/components/WeekNav";
import { TaskCard } from "../../src/components/TaskCard";
import { TabHeader } from "../../src/components/PageHeader";
import { MemberBubbles, NowLine, PlanningHero, starsLine } from "../../src/components/PlanningParts";
import { CervelleQuizCard } from "../../src/components/CervelleQuizCard";
import { Cascade, SlideIn, useDirection } from "../../src/components/motion";
import { ChevronRightIcon, RecurringIcon, ReshuffleIcon, GiftIcon, PartyIcon } from "../../src/components/icons";
import { shiftWeek, shortDate, tasksOn } from "../../src/lib/appointments";
import { useMeals, useMembers, useMonthlyBudget, useRecipes, useTaskDone, useTasks, useToggleTaskDone } from "../../src/hooks/useApi";
import { cheerLine, memberColor, memberProgress, nextTask, nowLineIndex, starsToWin, untilLabel } from "../../src/lib/planningView";
import { nowTime, todayLines, todaySummary } from "../../src/lib/today";
import { currentMonth } from "../../src/lib/money";
import { dayKey } from "../../src/lib/appointments";
import { EmptyState } from "../../src/components/Playful";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { weekKey } from "../../src/lib/stars";
import { useAuthStore, useIsChildAccount } from "../../src/state/authStore";
import { color, space } from "../../src/theme/tokens";
import { dayOfWeek, progressLine, todayWeekday, WEEKDAYS_FULL } from "../../src/lib/weekdays";
import { daysUntilBirthday } from "../../src/lib/notifications";
import type { Weekday } from "../../src/api/types";
import { de } from "../../src/lib/elision";

const BIRTHDAY_LOOKAHEAD_DAYS = 7;

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const isChild = useIsChildAccount();
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  // Le contenu du jour glisse du côté du jour choisi.
  const dayDir = useDirection(selected);
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
  // Une personne à la fois : sa bulle montre son planning, « Tous » celui de la famille.
  const selectedMemberId = filterIds.find((id) => memberIdsAll.includes(id)) ?? null;
  const selectedIndex = members.findIndex((m) => m.id === selectedMemberId);
  const selectedMember = selectedIndex >= 0 ? members[selectedIndex] : null;
  const categoryTasks = useMemo(() => filterByCategories(tasksOn(tasks, selected, week), filterCategories), [tasks, selected, week, filterCategories]);
  const dayTasks = useMemo(
    () => filterByMembers(categoryTasks, selectedMemberId ? [selectedMemberId] : [], memberIdsAll),
    [categoryTasks, selectedMemberId, memberIdsAll]
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
  const familyCheckable = categoryTasks.filter(isCheckable);
  const familyDone = familyCheckable.filter((t) => doneIds.has(t.id)).length;

  // L'heure avance toute seule : trait « maintenant » et prochaine tâche.
  const [now, setNow] = useState(nowTime());
  useEffect(() => {
    const id = setInterval(() => setNow(nowTime()), 30_000);
    return () => clearInterval(id);
  }, []);
  const isToday = isCurrentWeek && selected === today;
  const next = isToday ? nextTask(dayTasks, doneIds, now) : null;
  const nowAt = isToday ? nowLineIndex(dayTasks, now) : -1;

  // Carte du haut : repas du soir et budget pour la famille ; encouragement et étoiles pour une personne.
  const { data: meals = [] } = useMeals();
  const { data: recipes = [] } = useRecipes();
  const { data: budget } = useMonthlyBudget(currentMonth());
  const lines = todayLines(todaySummary(today, now, tasks, meals, recipes, budget, dayKey(new Date())));
  const firstName = user?.name?.trim().split(" ")[0];
  const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const hero = selectedMember
    ? {
        done: doneCount,
        total: checkable.length,
        tint: memberColor(selectedIndex),
        title: cheerLine(selectedMember.name, doneCount, checkable.length),
        lines: checkable.some((t) => t.stars > 0)
          ? [{ kind: "stars" as const, text: starsLine(starsToWin(checkable, doneIds), isToday) }]
          : [{ kind: "plain" as const, text: progress.detail }],
      }
    : {
        done: familyDone,
        total: familyCheckable.length,
        tint: undefined,
        title: `${firstName ? `Salut ${firstName}` : "Salut"}, ${lowerFirst(progressLine(familyDone, familyCheckable.length).title)}`,
        lines: [
          { kind: "meal" as const, text: lines.dinner, onPress: () => router.push("/repas") },
          { kind: "budget" as const, text: lines.budget, danger: lines.overBudget, onPress: () => router.push("/budget?tab=budget") },
        ],
      };

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
      <TabHeader title="Planning" />

      <PlanningHero {...hero} />

      {members.length > 1 && (
        <MemberBubbles
          all={{ done: familyDone, total: familyCheckable.length }}
          bubbles={members.map((m, i) => ({ id: m.id, label: m.name, initial: m.name.trim().charAt(0).toUpperCase(), tint: memberColor(i), ...memberProgress(categoryTasks, m.id, doneIds) }))}
          selectedId={selectedMemberId}
          onSelect={(id) => setFilterIds(id ? [id] : [])}
        />
      )}

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

      <CervelleQuizCard />

      <View style={{ gap: space.sm }}>
        <WeekNav week={week} current={currentWeek} onPrev={() => goToWeek(weekOffset - 1)} onNext={() => goToWeek(weekOffset + 1)} />
        <WeekStrip selected={selected} onSelect={setSelected} today={isCurrentWeek ? today : null} week={week} />
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

      <SlideIn k={`${week}-${selected}`} direction={dayDir} style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text heading weight="semibold" size={16}>
            {selectedMember && !isChild ? `${WEEKDAYS_FULL[selected]} ${de(selectedMember.name)}` : `${WEEKDAYS_FULL[selected]} ${shortDate(day)}`}
          </Text>
          {dayTasks.length > 0 && (
            <Text size={12} tone="faint">
              {dayTasks.length} tâche{dayTasks.length > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {!isLoading && dayTasks.length === 0 && (
          <Card>
            <EmptyState title="Journée libre" detail="Rien de prévu ce jour-là. Profites-en, ou ajoute une tâche avec le « + »." />
          </Card>
        )}
        {dayTasks.map((task, i) => (
          <Cascade key={task.id} index={i} style={{ gap: space.sm }}>
            {i === nowAt && <NowLine time={now} />}
            <TaskCard
              task={task}
              members={members}
              done={doneIds.has(task.id)}
              onToggleDone={() => onToggle(task.id)}
              soon={next?.id === task.id ? untilLabel(task.time, now) : undefined}
              showStars={!!selectedMember}
            />
          </Cascade>
        ))}
        {nowAt === dayTasks.length && dayTasks.length > 0 && <NowLine time={now} />}
      </SlideIn>

      <Pressable onPress={() => router.push("/tasks")} accessibilityRole="button">
        <Card row style={{ alignItems: "center" }}>
          <RecurringIcon size={16} color={color.accent400} />
          <Text size={15} weight="medium" style={{ flex: 1, marginLeft: space.sm }}>
            Toutes les tâches
          </Text>
          <Text size={12} tone="faint" style={{ marginRight: space.sm }}>
            {tasks.length}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      {!isChild ? (
        <Pressable onPress={() => router.push("/sorties")} accessibilityRole="button">
          <Card row style={{ alignItems: "center" }}>
            <Text size={16}>🌤️</Text>
            <Text size={15} weight="medium" style={{ flex: 1, marginLeft: space.sm }}>
              Sorties & idées
            </Text>
            <Text size={12} tone="faint" style={{ marginRight: space.sm }}>
              Que faire ce week-end ?
            </Text>
            <ChevronRightIcon size={14} color={color.neutral500} />
          </Card>
        </Pressable>
      ) : null}

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
