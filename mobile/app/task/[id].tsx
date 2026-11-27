import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Tag } from "../../src/components/Tag";
import { TopBar } from "../../src/components/TopBar";
import { Avatar } from "../../src/components/Avatar";
import { CalendarIcon, ClockIcon, DeadlineIcon, PinIcon, StarIcon } from "../../src/components/icons";
import { shortDate } from "../../src/lib/appointments";
import { Button } from "../../src/components/Button";
import { isChild, starsLabel, weekKey } from "../../src/lib/stars";
import { errorText } from "../../src/lib/errors";
import { useDeleteTask, useMembers, useStars, useTasks, useToggleStar } from "../../src/hooks/useApi";
import { useToastStore } from "../../src/state/toastStore";
import { useAuthStore } from "../../src/state/authStore";
import { color, space, gutter } from "../../src/theme/tokens";
import { categoryColor, formatDuration, priorityLabel, WEEKDAYS_FULL } from "../../src/lib/weekdays";
import { seriesOf } from "../../src/lib/taskSeries";
import { describeSchedule, type DayTimes } from "../../src/lib/dayTimes";

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();
  const deleteTask = useDeleteTask();
  const task = tasks.find((t) => t.id === id);
  const week = weekKey();
  const { data: starsState } = useStars(week);
  const toggleStar = useToggleStar();
  const user = useAuthStore((s) => s.user);
  const viewerIsChild = user?.familyRole === "child";

  if (!task) {
    return (
      <Screen scroll={false}>
        <TopBar title="Tâche" onBack={() => router.back()} />
        <Text tone="muted" style={{ padding: gutter }}>
          Cette tâche n'existe plus.
        </Text>
      </Screen>
    );
  }

  // Un enfant ne modifie que les tâches où il est indiqué (le serveur le vérifie aussi).
  const canEdit = !viewerIsChild || (!!user?.childMemberId && task.memberIds.includes(user.childMemberId));
  const assigned = task.memberIds.map((mid) => members.find((m) => m.id === mid)).filter((m): m is NonNullable<typeof m> => !!m);

  const siblings = seriesOf(tasks, task);
  const schedule: DayTimes = {};
  for (const t of siblings) schedule[t.weekday] ??= t.time;

  async function remove(ids: string[]) {
    try {
      for (const tid of ids) await deleteTask.mutateAsync(tid);
      useToastStore.getState().show(ids.length > 1 ? "Tâches supprimées." : "Tâche supprimée.");
      router.back();
    } catch {
      useToastStore.getState().show("Impossible de supprimer la tâche.");
    }
  }

  function onDelete() {
    if (siblings.length > 1) {
      Alert.alert("Supprimer la tâche", `« ${task!.title} » a lieu ${siblings.length} fois par semaine.`, [
        { text: "Annuler", style: "cancel" },
        { text: `Le ${WEEKDAYS_FULL[task!.weekday].toLowerCase()} seulement`, onPress: () => remove([task!.id]) },
        { text: "Tous les jours", style: "destructive", onPress: () => remove(siblings.map((t) => t.id)) },
      ]);
      return;
    }
    Alert.alert("Supprimer la tâche", `Supprimer « ${task!.title} » ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => remove([task!.id]) },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar
        title={task.title}
        onBack={() => router.back()}
        onDuplicate={() => router.push(`/task/new?duplicate=${task.id}`)}
        {...(canEdit ? { onEdit: () => router.push(`/task/new?edit=${task.id}`), onDelete } : {})}
      />
      <View style={{ padding: gutter, gap: space.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Tag label={task.category} tint={categoryColor(task.category)} />
          {task.priority === "high" && <Tag label={priorityLabel(task.priority)} variant="outline" />}
          {task.appointmentDate && <Tag label="Rendez-vous" variant="outline" />}
          {task.remind && <Tag label={task.remind === "eve" ? "Rappel la veille" : "Rappel 1 h avant"} variant="neutral" />}
          {task.recurring && <Tag label="Récurrente" variant="neutral" />}
          {task.reminder && <Tag label="Rappel activé" variant="neutral" />}
          {task.flexible && <Tag label="Flexible" variant="neutral" />}
        </View>

        <Card style={{ gap: space.sm }}>
          <Row
            icon={<CalendarIcon size={16} color={color.neutral400} />}
            label={task.appointmentDate ? `${WEEKDAYS_FULL[task.weekday]} ${shortDate(task.appointmentDate)} ${task.appointmentDate.slice(0, 4)}` : WEEKDAYS_FULL[task.weekday]}
          />
          {task.appointmentDate && task.location?.trim() ? <Row icon={<PinIcon size={16} color={color.neutral400} />} label={task.location.trim()} /> : null}
          {siblings.length > 1 && (
            <Text size={13} tone="muted">
              Tous les jours de cette tâche : {describeSchedule(schedule)}
            </Text>
          )}
          <Row icon={<ClockIcon size={16} color={color.neutral400} />} label={`${task.time} · ${formatDuration(task.duration)}`} />
          {task.deadlineWeekday !== null && (
            <Row icon={<DeadlineIcon size={16} color={color.neutral400} />} label={`Échéance : ${WEEKDAYS_FULL[task.deadlineWeekday]}`} />
          )}
        </Card>

        {assigned.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Assignée à
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              {assigned.map((m) => (
                <View key={m.id} style={{ alignItems: "center", gap: space.xs }}>
                  <Avatar initials={m.initials} bg={m.tint === "neutral" ? color.neutral700 : color.accent800} fg={m.tint === "neutral" ? color.neutral100 : color.accent100} size={32} />
                  <Text size={12} tone="muted">
                    {m.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {(task.stars ?? 1) > 0 && !viewerIsChild && assigned.some((m) => isChild(m)) && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Étoiles cette semaine · {starsLabel(task.stars ?? 1)} par enfant
            </Text>
            {assigned
              .filter((m) => isChild(m))
              .map((m) => {
                const done = !!starsState?.completions.some((c) => c.taskId === task.id && c.memberId === m.id);
                return (
                  <Card key={m.id} row style={{ alignItems: "center", gap: space.sm }}>
                    <StarIcon size={18} color={done ? color.pillar3 : color.neutral600} />
                    <Text size={15} style={{ flex: 1 }}>
                      {m.name}
                    </Text>
                    <Button
                      label={done ? "Fait ✓" : "C'est fait"}
                      variant={done ? "secondary" : "primary"}
                      needsNetwork
                      loading={toggleStar.isPending && toggleStar.variables?.memberId === m.id}
                      onPress={() =>
                        toggleStar.mutate(
                          { taskId: task.id, memberId: m.id, week, done: !done },
                          {
                            onSuccess: () => useToastStore.getState().show(done ? `Étoiles retirées à ${m.name}.` : `+${task.stars ?? 1} ★ pour ${m.name} !`),
                            onError: (e) => useToastStore.getState().show(errorText(e, "enregistrer les étoiles")),
                          },
                        )
                      }
                    />
                  </Card>
                );
              })}
          </View>
        )}

        {task.notes ? (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Notes
            </Text>
            <Text size={15}>{task.notes}</Text>
          </View>
        ) : null}

        {task.synced && (
          <Text size={13} tone="faint">
            Synchronisée avec {task.externalProvider === "outlook" ? "Outlook" : task.externalProvider === "apple" ? "le calendrier du téléphone" : "Google Agenda"}
          </Text>
        )}
      </View>
    </Screen>
  );
}

function Row({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      {icon}
      <Text size={15}>{label}</Text>
    </View>
  );
}
