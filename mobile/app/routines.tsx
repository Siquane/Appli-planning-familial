import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../src/api/client";
import { Screen } from "../src/components/Screen";
import { Pressable } from "../src/components/Touchable";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { TopBar } from "../src/components/TopBar";
import { useToastStore } from "../src/state/toastStore";
import { errorText } from "../src/lib/errors";
import { color, gutter, radius, space } from "../src/theme/tokens";

// Routines du matin et du soir des enfants : le parent choisit les étapes
// ici ; l'enfant les coche dans Cervelle (1 étoile par routine finie).

type Step = { id?: string; emoji: string; label: string };
type Kind = "matin" | "soir";
type Routines = { today: string; ideas: Record<Kind, Step[]>; routines: { kind: Kind; steps: Step[]; checked: string[]; done: boolean }[] };
type Learner = { id: string; name: string };

const KINDS: { key: Kind; label: string }[] = [
  { key: "matin", label: "☀️ Matin" },
  { key: "soir", label: "🌙 Soir" },
];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: on ? color.accent : color.edgeSoft, backgroundColor: on ? color.accent900 : color.surface }}>
      <Text size={14} weight={on ? "semibold" : "regular"}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function RoutinesScreen() {
  const qc = useQueryClient();
  const learners = useQuery({ queryKey: ["cervelleLearners"], queryFn: () => api.get<{ learners: Learner[] }>("/cervelle/learners").then((r) => r.learners) });
  const [lid, setLid] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("matin");
  useEffect(() => {
    if (!lid && learners.data?.length) setLid(learners.data[0].id);
  }, [learners.data]);
  const data = useQuery({ queryKey: ["routines", lid], enabled: !!lid, queryFn: () => api.get<Routines>(`/cervelle/learners/${lid}/routines`) });
  const [steps, setSteps] = useState<Step[]>([]);
  const [emoji, setEmoji] = useState("⭐");
  const [label, setLabel] = useState("");
  const current = data.data?.routines.find((r) => r.kind === kind);
  useEffect(() => {
    setSteps(current?.steps ?? []);
  }, [current, kind, lid]);
  const save = useMutation({
    mutationFn: (next: Step[]) => api.put<Routines>(`/cervelle/learners/${lid}/routines/${kind}`, { steps: next }),
    onSuccess: (r) => qc.setQueryData(["routines", lid], r),
    onError: (e) => useToastStore.getState().show(errorText(e, "enregistrer la routine")),
  });
  const update = (next: Step[]) => {
    setSteps(next);
    save.mutate(next);
  };
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  if (learners.data && learners.data.length === 0) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Routines" onBack={() => router.back()} />
        <View style={{ padding: gutter }}>
          <Text tone="muted">Les routines se cochent dans Cervelle. Crée d'abord le profil Cervelle de ton enfant.</Text>
        </View>
      </Screen>
    );
  }

  const ideas = (data.data?.ideas[kind] ?? []).filter((i) => !steps.some((s) => s.label === i.label));
  const doneToday = current?.done;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Routines" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.md }} keyboardShouldPersistTaps="handled">
        <Text tone="muted" size={14}>
          Les étapes à faire chaque matin et chaque soir. Ton enfant les coche dans Cervelle et gagne une étoile quand la routine est finie.
        </Text>
        {(learners.data?.length ?? 0) > 1 ? (
          <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
            {learners.data!.map((l) => (
              <Chip key={l.id} label={l.name} on={l.id === lid} onPress={() => setLid(l.id)} />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: space.xs }}>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} on={k.key === kind} onPress={() => setKind(k.key)} />
          ))}
        </View>
        {doneToday ? (
          <Text size={13} style={{ color: color.success }}>
            ✓ Faite aujourd'hui
          </Text>
        ) : null}

        <Card style={{ gap: space.sm }}>
          {steps.length === 0 ? (
            <Text tone="muted" size={14}>
              Pas encore d'étape. Ajoute-en avec les idées ci-dessous.
            </Text>
          ) : null}
          {steps.map((s, i) => (
            <View key={s.id ?? `${s.label}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 }}>
              <Text size={22}>{s.emoji}</Text>
              <Text style={{ flex: 1 }}>{s.label}</Text>
              <Pressable onPress={() => move(i, -1)} accessibilityLabel={`Monter ${s.label}`} hitSlop={8} style={{ padding: 6 }}>
                <Text tone="muted">↑</Text>
              </Pressable>
              <Pressable onPress={() => move(i, 1)} accessibilityLabel={`Descendre ${s.label}`} hitSlop={8} style={{ padding: 6 }}>
                <Text tone="muted">↓</Text>
              </Pressable>
              <Pressable onPress={() => update(steps.filter((_, k) => k !== i))} accessibilityLabel={`Retirer ${s.label}`} hitSlop={8} style={{ padding: 6 }}>
                <Text style={{ color: color.danger }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </Card>

        {ideas.length ? (
          <>
            <Text weight="medium">Idées</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {ideas.map((i) => (
                <Chip key={i.label} label={`${i.emoji} ${i.label}`} on={false} onPress={() => update([...steps, i])} />
              ))}
            </View>
          </>
        ) : null}

        <Text weight="medium">Une autre étape</Text>
        <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
          <View style={{ width: 70 }}>
            <TextField label="Emoji" value={emoji} onChangeText={setEmoji} maxLength={4} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Étape" value={label} onChangeText={setLabel} placeholder="Ex. Donner à manger au chat" maxLength={40} />
          </View>
        </View>
        <Button
          label="Ajouter l'étape"
          variant="secondary"
          disabled={!label.trim() || steps.length >= 12}
          onPress={() => {
            update([...steps, { emoji: emoji.trim() || "⭐", label: label.trim() }]);
            setLabel("");
          }}
        />
      </ScrollView>
    </Screen>
  );
}
