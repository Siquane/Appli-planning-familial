import { View } from "react-native";
import { Pressable } from "./Touchable";
import { router } from "expo-router";
import { Text } from "./Text";
import { Card } from "./Card";
import { Tag } from "./Tag";
import { AvatarStack } from "./Avatar";
import { BriefcaseIcon, PinIcon, RecurringIcon, SchoolBagIcon, StarIcon } from "./icons";
import { DoneCheck } from "./Playful";
import { color, space } from "../theme/tokens";
import { categoryColor, formatDuration } from "../lib/weekdays";
import { isCheckable } from "../lib/planningFilter";
import { endTime } from "../lib/planningView";
import type { Member, Task } from "../api/types";

// Une tâche : l'heure dans une colonne à gauche, le titre et les personnes,
// puis la case ronde « fait » à droite (Planning). Sans `onToggleDone`, la
// carte reste une simple ligne cliquable (recherche…). École et Travail ne se
// cochent pas : bloc en pointillés avec l'heure de fin et une petite icône.
// `soon` (« dans 48 min ») fait briller la prochaine tâche ; `showStars`
// affiche les étoiles à gagner (planning d'une personne).
export function TaskCard({
  task,
  members,
  done,
  onToggleDone,
  soon,
  showStars,
}: {
  task: Task;
  members: Member[];
  done?: boolean;
  onToggleDone?: () => void;
  soon?: string;
  showStars?: boolean;
}) {
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
  const checkable = isCheckable(task);
  const canToggle = !!onToggleDone && checkable;
  const block = !!onToggleDone && !checkable;
  const tint = categoryColor(task.category);
  const toggleLabel = done ? "Décocher" : "Marquer comme faite";
  const stars = showStars && checkable && task.stars > 0;
  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      accessibilityLabel={`${task.title}, ${task.time}, ${task.category}${done ? ", faite" : ""}${soon ? `, ${soon}` : ""}`}
      accessibilityHint="Ouvre la tâche"
      accessibilityActions={canToggle ? [{ name: "activate" }, { name: "toggleDone", label: toggleLabel }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "toggleDone") onToggleDone?.();
        else if (e.nativeEvent.actionName === "activate") router.push(`/task/${task.id}`);
      }}
    >
      <Card
        row
        bracket={!block && !soon}
        style={{
          alignItems: "center",
          gap: space.md,
          paddingVertical: space.md,
          paddingHorizontal: space.md,
          opacity: done ? 0.7 : 1,
          ...(block ? { borderWidth: 1, borderStyle: "dashed", borderColor: tint + "59", backgroundColor: tint + "12" } : null),
          ...(soon ? { borderWidth: 1.5, borderColor: color.accent, boxShadow: `0 0 18px ${color.accent}40` } : null),
          ...(!block && !soon && task.recurring ? { borderWidth: 1, borderColor: color.accent800 } : null),
        }}
      >
        <View style={{ width: 52, gap: 2 }}>
          <Text mono size={13} weight="medium" style={soon ? { color: color.accent } : undefined}>
            {task.time}
          </Text>
          <Text size={11} tone="faint" mono numberOfLines={1}>
            {block ? `→ ${endTime(task.time, task.duration)}` : formatDuration(task.duration)}
          </Text>
        </View>

        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            {task.recurring && !block && <RecurringIcon size={11} color={color.accent400} />}
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
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "center", flexWrap: "wrap" }}>
            {assigned.length > 0 && <AvatarStack avatars={assigned} size={20} bgBehind={color.surface} />}
            {stars ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }} accessibilityLabel={`${task.stars} étoile${task.stars > 1 ? "s" : ""}`}>
                <StarIcon size={11} color={color.amber} />
                <Text size={11} weight="semibold" style={{ color: color.amber }}>
                  {done ? `${task.stars} gagnée${task.stars > 1 ? "s" : ""}` : task.stars}
                </Text>
              </View>
            ) : null}
            {soon ? (
              <Text size={11} weight="semibold" tone="accent">
                {soon}
              </Text>
            ) : null}
            {task.appointmentDate && <Tag label="Rendez-vous" variant="outline" />}
            {!block && !soon && !stars && <Tag label={task.category} tint={tint} />}
            {task.priority === "high" && !task.appointmentDate && <Tag label="Priorité haute" variant="outline" />}
          </View>
        </View>

        {onToggleDone &&
          (checkable ? (
            <DoneCheck done={!!done} tint={soon ? color.accent : tint} label={task.title} onToggle={onToggleDone} />
          ) : (
            <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }} accessibilityLabel={task.category}>
              {task.category === "École" ? <SchoolBagIcon size={20} color={tint} /> : <BriefcaseIcon size={20} color={tint} />}
            </View>
          ))}
      </Card>
    </Pressable>
  );
}
