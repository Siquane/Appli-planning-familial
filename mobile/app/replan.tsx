import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Chip } from "../src/components/Chip";
import { TimeField } from "../src/components/TimeField";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ReshuffleIcon } from "../src/components/icons";
import { useConstraints, useReplanProposals, useUpdateTask } from "../src/hooks/useApi";
import { workSummary } from "../src/lib/workHours";
import { Pressable } from "../src/components/Touchable";
import { useToastStore } from "../src/state/toastStore";
import { color, space, gutter } from "../src/theme/tokens";
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from "../src/lib/weekdays";
import type { ReplanCandidate, Weekday } from "../src/api/types";

export default function ReplanScreen() {
  const { data: proposals = [], isLoading } = useReplanProposals();
  const { data: constraints } = useConstraints();
  const work = workSummary(constraints?.work);
  const updateTask = useUpdateTask();

  function apply(taskId: string, title: string, candidate: Pick<ReplanCandidate, "weekday" | "time">) {
    updateTask.mutate(
      { id: taskId, data: { weekday: candidate.weekday, time: candidate.time } },
      { onSuccess: () => useToastStore.getState().show(`« ${title} » déplacée au ${WEEKDAYS_FULL[candidate.weekday]} ${candidate.time}.`) }
    );
  }

  return (
    <Screen scroll={false} padded={false} techGrid>
      <TopBar title="Replanifier ma semaine" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <ReshuffleIcon size={18} color={color.accent} />
          <Text tone="muted" size={13} style={{ flex: 1 }}>
            Passerelle propose de meilleurs créneaux pour tes tâches flexibles, en tenant compte de tes contraintes.
          </Text>
        </View>

        <Pressable onPress={() => router.push("/schedule")} accessibilityRole="link">
          <Text size={13} tone={work ? "faint" : "accent"}>
            {work ? `Ton travail : ${work} · Modifier` : "Indique tes horaires de travail pour ne rien recevoir pendant ces heures →"}
          </Text>
        </Pressable>

        {!isLoading && proposals.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
            <Text tone="muted" size={13} center>
              Aucune tâche flexible pour l'instant. Coche « Flexible » sur une tâche pour que Passerelle puisse la déplacer.
            </Text>
          </Card>
        )}

        {proposals.map((p) => (
          <Card key={p.taskId} bg={color.accent900} style={{ gap: space.sm }}>
            <View>
              <Text weight="medium" size={15}>
                {p.title}
              </Text>
              <Text size={13} tone="faint" mono>
                Actuellement : {WEEKDAYS_FULL[p.currentWeekday]} {p.currentTime}
              </Text>
            </View>
            <View style={{ gap: space.sm }}>
              {p.candidates.map((c, i) => (
                <Card key={i} row style={{ alignItems: "center" }} bracket={false}>
                  <View style={{ flex: 1 }}>
                    <Text weight="medium" size={13} mono>
                      {WEEKDAYS_FULL[c.weekday]} · {c.time}
                    </Text>
                    <Text size={12} tone="muted">
                      {c.reason}
                    </Text>
                  </View>
                  <Button label="Appliquer" variant="ghost" onPress={() => apply(p.taskId, p.title, c)} />
                </Card>
              ))}
            </View>
            <OtherSlot weekday={p.currentWeekday as Weekday} time={p.currentTime} onApply={(weekday, time) => apply(p.taskId, p.title, { weekday, time })} />
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

/** « Autre moment » : n'importe quel jour et n'importe quelle heure, au choix. */
function OtherSlot({ weekday, time, onApply }: { weekday: Weekday; time: string; onApply: (weekday: Weekday, time: string) => void }) {
  const [day, setDay] = useState<Weekday>(weekday);
  const [hour, setHour] = useState(time);
  const [open, setOpen] = useState(false);
  if (!open) return <Button label="Choisir un autre moment" variant="ghost" onPress={() => setOpen(true)} />;
  return (
    <Card style={{ gap: space.sm }} bracket={false}>
      <Text weight="medium" size={13}>
        Autre moment
      </Text>
      <View style={{ flexDirection: "row", gap: space.xs }}>
        {WEEKDAYS_SHORT.map((label, i) => (
          <Chip key={label} label={label} selected={day === i} onPress={() => setDay(i as Weekday)} size="sm" fill />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <TimeField value={hour} onChange={setHour} />
        </View>
        <Button label="Appliquer" variant="primary" onPress={() => onApply(day, hour)} disabled={!/^\d{2}:\d{2}$/.test(hour)} />
      </View>
    </Card>
  );
}
