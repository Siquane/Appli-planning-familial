import { View } from "react-native";
import { Pressable } from "./Touchable";
import { router } from "expo-router";
import { Text } from "./Text";
import { Card } from "./Card";
import { Tag } from "./Tag";
import { AvatarStack } from "./Avatar";
import { ClockIcon, PinIcon, RecurringIcon } from "./icons";
import { DoneCheck } from "./Playful";
import { color, space } from "../theme/tokens";
import { categoryColor, formatDuration } from "../lib/weekdays";
import type { Member, Task } from "../api/types";

// `done` / `onToggleDone` : la case ronde « fait » (Planning). Sans eux,
// la carte reste une simple ligne cliquable (recherche, réglages…).
export function TaskCard({ task, members, done, onToggleDone }: { task: Task; members: Member[]; done?: boolean; onToggleDone?: () => void }) {
  const assigned = task.memberIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m)
    .map((m) => ({
      initials: m.initials,
      bg: m.tint === "neutral" ? color.neutral700 : color.accent800,
      fg: m.tint === "neutral" ? color.neutral100 : color.accent100,
    }));

  return (
    <Pressable onPress={() => router.push(`/task/${task.id}`)}>
      <Card
        row
        style={{
          alignItems: "center",
          opacity: done ? 0.7 : 1,
          ...(task.recurring ? { borderWidth: 1, borderColor: color.accent800 } : null),
        }}
      >
        {onToggleDone && <DoneCheck done={!!done} tint={categoryColor(task.category)} label={task.title} onToggle={onToggleDone} />}

        <View style={{ width: 52, gap: 3 }}>
          <Text mono size={13} weight="medium">
            {task.time}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <ClockIcon size={9} color={color.neutral500} />
            <Text size={11} tone="faint" mono>
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
