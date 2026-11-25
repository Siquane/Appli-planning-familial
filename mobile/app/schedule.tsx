import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { TimeField } from "../src/components/TimeField";
import { TopBar } from "../src/components/TopBar";
import { useConstraints, useUpdateConstraints } from "../src/hooks/useApi";
import { goBack, useBackFallback } from "../src/lib/navigation";
import { WEEKDAYS_SHORT } from "../src/lib/weekdays";
import { errorText } from "../src/lib/errors";
import { useToastStore } from "../src/state/toastStore";
import { space, gutter } from "../src/theme/tokens";

const toast = (m: string) => useToastStore.getState().show(m);

// Horaires que « Replanifier » et le placement automatique respectent :
// travail (propre à chaque compte) + sommeil, déjeuner, ne pas déranger (famille).
export default function ScheduleScreen() {
  const { data: constraints } = useConstraints();
  const update = useUpdateConstraints();
  useBackFallback("/profile");

  const [workDays, setWorkDays] = useState<number[]>([]);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:30");
  const [sleepStart, setSleepStart] = useState("21:00");
  const [sleepEnd, setSleepEnd] = useState("07:00");
  const [lunchStart, setLunchStart] = useState("12:00");
  const [lunchEnd, setLunchEnd] = useState("13:30");
  const [dndStart, setDndStart] = useState("20:00");
  const [dndEnd, setDndEnd] = useState("22:00");

  // Rempli une seule fois : un rafraîchissement ne doit pas effacer la saisie.
  const loaded = useRef(false);
  useEffect(() => {
    if (!constraints || loaded.current) return;
    loaded.current = true;
    setWorkDays(constraints.work?.days ?? []);
    setWorkStart(constraints.work?.start ?? "09:00");
    setWorkEnd(constraints.work?.end ?? "17:30");
    setSleepStart(constraints.sleepStart);
    setSleepEnd(constraints.sleepEnd);
    setLunchStart(constraints.lunchStart);
    setLunchEnd(constraints.lunchEnd);
    setDndStart(constraints.dndStart);
    setDndEnd(constraints.dndEnd);
  }, [constraints]);

  const toggleDay = (d: number) => setWorkDays((days) => (days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b)));

  async function onSave() {
    try {
      await update.mutateAsync({ workDays, workStart, workEnd, sleepStart, sleepEnd, lunchStart, lunchEnd, dndStart, dndEnd });
      toast("Horaires enregistrés.");
      goBack("/profile");
    } catch (e) {
      toast(errorText(e, "enregistrer les horaires"));
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Mes horaires" onBack={() => goBack("/profile")} save={{ onPress: onSave, loading: update.isPending, disabled: !constraints, needsNetwork: true }} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        <Text size={13} tone="faint">
          Passerelle ne propose jamais de tâche pendant ces heures (« Replanifier ma semaine », placement automatique).
        </Text>

        <Card style={{ gap: space.sm }}>
          <Text weight="medium" size={15}>
            Mon travail
          </Text>
          <Text size={12} tone="faint">
            Propre à ton compte : les autres membres de la famille ont leurs propres horaires.
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {WEEKDAYS_SHORT.map((label, d) => (
              <Chip key={label} label={label} selected={workDays.includes(d)} onPress={() => toggleDay(d)} size="sm" fill />
            ))}
          </View>
          {workDays.length > 0 ? (
            <Range label="Horaires" start={workStart} end={workEnd} onStart={setWorkStart} onEnd={setWorkEnd} />
          ) : (
            <Text size={13} tone="muted">
              Coche les jours où tu travailles.
            </Text>
          )}
        </Card>

        <Card style={{ gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text weight="medium" size={15}>
              Plages de la famille
            </Text>
            <Text size={12} tone="faint">
              Communes à toute la famille.
            </Text>
          </View>
          <Range label="Sommeil" start={sleepStart} end={sleepEnd} onStart={setSleepStart} onEnd={setSleepEnd} />
          <Range label="Pause déjeuner" start={lunchStart} end={lunchEnd} onStart={setLunchStart} onEnd={setLunchEnd} />
          <Range label="Ne pas déranger" start={dndStart} end={dndEnd} onStart={setDndStart} onEnd={setDndEnd} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Range({ label, start, end, onStart, onEnd }: { label: string; start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <TimeField value={start} onChange={onStart} />
        </View>
        <Text tone="faint">→</Text>
        <View style={{ flex: 1 }}>
          <TimeField value={end} onChange={onEnd} />
        </View>
      </View>
    </View>
  );
}
