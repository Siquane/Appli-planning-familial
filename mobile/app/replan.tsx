import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ReshuffleIcon } from "../src/components/icons";
import { useReplanProposals, useUpdateTask } from "../src/hooks/useApi";
import { useToastStore } from "../src/state/toastStore";
import { color, space, gutter } from "../src/theme/tokens";
import { WEEKDAYS_FULL } from "../src/lib/weekdays";
import type { ReplanCandidate } from "../src/api/types";

export default function ReplanScreen() {
  const { data: proposals = [], isLoading } = useReplanProposals();
  const updateTask = useUpdateTask();

  function apply(taskId: string, title: string, candidate: ReplanCandidate) {
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
                    <Text size={11} tone="muted">
                      {c.reason}
                    </Text>
                  </View>
                  <Button label="Appliquer" variant="ghost" onPress={() => apply(p.taskId, p.title, c)} />
                </Card>
              ))}
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
