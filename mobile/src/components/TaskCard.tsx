import { View } from "react-native";
import { Pressable } from "./Touchable";
import { router } from "expo-router";
import { Text } from "./Text";
import { Card } from "./Card";
import { Tag } from "./Tag";
import { AvatarStack } from "./Avatar";
import { BriefcaseIcon, ClockIcon, PinIcon, RecurringIcon, SchoolBagIcon } from "./icons";
import { DoneCheck } from "./Playful";
import { color, space } from "../theme/tokens";
import { categoryColor, formatDuration } from "../lib/weekdays";
import { isCheckable } from "../lib/planningFilter";
import type { Member, Task } from "../api/types";

// `done` / `onToggleDone` : la case ronde « fait » (Planning). Sans eux,
// la carte reste une simple ligne cliquable (recherche, réglages…). École et
// Travail ne se cochent pas : une petite icône prend la place de la case.
export function TaskCard({ task, members, done, onToggleDone }: { task: Task; members: Member[]; done?: boolean; onToggleDone?: () => void }) {
  const assigned = task.memberIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m)
    .map((m) => ({
      initials: m.initials,
      bg: m.tint === "neutral" ? color.neutral700 : color.accent800,
      fg: m.tint === "neutral" ? color.neutral100 : color.accent100,
    }));

  // Lecteur d'écran : la carte est lue d'un bloc ; la case « fait » y est
  // proposée comme action (« Marquer comme faite ») plutôt que cachée dedans.
  const checkable = !!onToggleDone && isCheckable(task);
  const toggleLabel = done ? "Décocher" : "Marquer comme faite";
  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      accessibilityLabel={`${task.title}, ${task.time}, ${task.category}${done ? ", faite" : ""}`}
      accessibilityHint="Ouvre la tâche"
      accessibilityActions={checkable ? [{ name: "activate" }, { name: "toggleDone", label: toggleLabel }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "toggleDone") onToggleDone?.();
        else if (e.nativeEvent.actionName === "activate") router.push(`/task/${task.id}`);
      }}
    >
      <Card
        row
        style={{
          alignItems: "center",
          opacity: done ? 0.7 : 1,
          ...(task.recurring ? { borderWidth: 1, borderColor: color.accent800 } : null),
        }}
      >
        {onToggleDone &&
          (isCheckable(task) ? (
            <DoneCheck done={!!done} tint={categoryColor(task.category)} label={task.title} onToggle={onToggleDone} />
          ) : (
            <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }} accessibilityLabel={task.category}>
              {task.category === "École" ? <SchoolBagIcon size={20} color={categoryColor(task.category)} /> : <BriefcaseIcon size={20} color={categoryColor(task.category)} />}
            </View>
          ))}

        <View style={{ width: 60, gap: 3 }}>
          <Text mono size={13} weight="medium">
            {task.time}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <ClockIcon size={9} color={color.neutral500} />
            <Text size={11} tone="faint" mono numberOfLines={1} style={{ flexShrink: 1 }}>
              {formatDuration(task.duration)}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            {task.recurring && <RecurringIcon size={11} color={color.accent400} />}
            <Text
              weight="medium"
              size={15}
              numberOfLines={1}
              tone={done ? "muted" : "text"}
              style={{ flexShrink: 1, textDecorationLine: done ? "line-through" : "none" }}
            >
              {task.title}
            </Text>
          </View>
          {task.appointmentDate && task.location?.trim() ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <PinIcon size={11} color={color.neutral500} />
              <Text size={11} tone="faint" numberOfLines={1} style={{ flexShrink: 1 }}>
                {task.location.trim()}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
            {task.appointmentDate && <Tag label="Rendez-vous" variant="outline" />}
            <Tag label={task.category} tint={categoryColor(task.category)} />
            {task.priority === "high" && !task.appointmentDate && <Tag label="Priorité haute" variant="outline" />}
          </View>
        </View>

        {assigned.length > 0 && <AvatarStack avatars={assigned} size={22} />}
      </Card>
    </Pressable>
  );
}
