import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { StepDots } from "../../src/components/StepDots";
import { useConstraints, useUpdateConstraints } from "../../src/hooks/useApi";
import { space } from "../../src/theme/tokens";

export default function ConstraintsOnboardingScreen() {
  const { data: constraints } = useConstraints();
  const updateConstraints = useUpdateConstraints();

  const [sleepStart, setSleepStart] = useState("21:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("13:30");
  const [dndStart, setDndStart] = useState("20:00");
  const [dndEnd, setDndEnd] = useState("08:00");

  useEffect(() => {
    if (!constraints) return;
    setSleepStart(constraints.sleepStart);
    setSleepEnd(constraints.sleepEnd);
    setLunchStart(constraints.lunchStart);
    setLunchEnd(constraints.lunchEnd);
    setDndStart(constraints.dndStart);
    setDndEnd(constraints.dndEnd);
  }, [constraints]);

  function onContinue() {
    updateConstraints.mutate(
      { sleepStart, sleepEnd, lunchStart, lunchEnd, dndStart, dndEnd },
      { onSuccess: () => router.push("/(onboarding)/recurring-tasks") }
    );
  }

  return (
    <Screen keyboard style={{ justifyContent: "space-between", flexGrow: 1 }}>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          <Text heading weight="semibold" size={22}>
            Tes moments sans tâches
          </Text>
          <Text tone="muted" size={15}>
            Passerelle évite de proposer des tâches pendant ces créneaux. Écris les heures comme 21:00.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={13} tone="muted">
            Sommeil
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Début" value={sleepStart} onChangeText={setSleepStart} placeholder="21:00" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Fin" value={sleepEnd} onChangeText={setSleepEnd} placeholder="07:00" />
            </View>
          </View>

          <Text weight="medium" size={13} tone="muted">
            Pause déjeuner
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Début" value={lunchStart} onChangeText={setLunchStart} placeholder="12:00" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Fin" value={lunchEnd} onChangeText={setLunchEnd} placeholder="13:30" />
            </View>
          </View>

          <Text weight="medium" size={13} tone="muted">
            Ne pas déranger
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField label="Début" value={dndStart} onChangeText={setDndStart} placeholder="20:00" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Fin" value={dndEnd} onChangeText={setDndEnd} placeholder="08:00" />
            </View>
          </View>
        </View>
      </View>

      <View style={{ gap: space.md, alignItems: "center" }}>
        <StepDots step={2} total={5} />
        <Button label="Continuer" variant="primary" block onPress={onContinue} loading={updateConstraints.isPending} />
      </View>
    </Screen>
  );
}
