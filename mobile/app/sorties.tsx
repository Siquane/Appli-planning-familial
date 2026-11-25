import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../src/api/client";
import { Screen } from "../src/components/Screen";
import { Pressable } from "../src/components/Touchable";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { TopBar } from "../src/components/TopBar";
import { useCreateTask, useMembers } from "../src/hooks/useApi";
import { useToastStore } from "../src/state/toastStore";
import { errorText } from "../src/lib/errors";
import { color, gutter, radius, space } from "../src/theme/tokens";
import type { Weekday } from "../src/api/types";

// « Sorties & idées » : 5 idées d'activités en famille pour ce soir ou un
// jour à venir, selon la météo, le temps libre du planning et l'âge des
// enfants (proposées par Claude). Une idée choisie devient un rendez-vous
// « Loisirs » pour toute la famille.

type Idea = { emoji: string; title: string; description: string; place: "dedans" | "dehors"; cost: "gratuit" | "€" | "€€"; minutes: number; start: string };
type Weather = { label: string; emoji: string; tMin: number; tMax: number; rain: number };
type Ideas = { day: string; moment: "soir" | "journee"; city: string | null; weather: Weather | null; ideas: Idea[]; weekday: Weekday };

const DAYS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Ce soir, puis les 7 jours suivants (le prochain week-end en tête). */
function choices(): { key: string; label: string; day: string; moment: "soir" | "journee" }[] {
  const now = new Date();
  const out: { key: string; label: string; day: string; moment: "soir" | "journee" }[] = [{ key: "soir", label: "Ce soir", day: iso(now), moment: "soir" }];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 1 ? "Demain" : `${DAYS[d.getDay()]} ${d.getDate()}`;
    out.push({ key: iso(d), label, day: iso(d), moment: "journee" });
  }
  // Samedi et dimanche d'abord : c'est là qu'on a le plus de temps.
  const weekend = out.filter((c) => c.moment === "journee" && [0, 6].includes(new Date(`${c.day}T12:00:00`).getDay()));
  return [out[0], ...weekend, ...out.filter((c) => c !== out[0] && !weekend.includes(c))];
}

const endOf = (start: string, minutes: number) => {
  const [h, m] = start.split(":").map(Number);
  const t = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export default function OutingsScreen() {
  const days = choices();
  const [pick, setPick] = useState(days[1] ?? days[0]);
  const [city, setCity] = useState("");
  const settings = useQuery({ queryKey: ["outingSettings"], queryFn: () => api.get<{ city: string | null }>("/outings/settings") });
  useEffect(() => {
    if (settings.data?.city && !city) setCity(settings.data.city);
  }, [settings.data]);
  const { data: members = [] } = useMembers();
  const create = useCreateTask();
  const [added, setAdded] = useState<string[]>([]);
  const ideas = useMutation({
    mutationFn: (exclude: string[]) => api.post<Ideas>("/outings/ideas", { day: pick.day, moment: pick.moment, city: city.trim(), exclude }),
    onError: (e) => useToastStore.getState().show(errorText(e, "trouver des idées")),
  });
  const r = ideas.data;

  const add = (i: Idea) => {
    if (!r) return;
    create.mutate(
      { title: `${i.emoji} ${i.title}`, category: "Loisirs", weekday: r.weekday, time: i.start, duration: i.minutes, appointmentDate: r.day, notes: i.description, memberIds: members.map((m) => m.id), remind: null },
      {
        onSuccess: () => {
          setAdded((a) => [...a, i.title]);
          useToastStore.getState().show(`« ${i.title} » ajouté au planning.`);
        },
        onError: (e) => useToastStore.getState().show(errorText(e, "ajouter au planning")),
      },
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Sorties & idées" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.md }} keyboardShouldPersistTaps="handled">
        <Text tone="muted" size={14}>
          Quoi faire en famille ? 5 idées selon la météo, votre temps libre et l'âge des enfants.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
          {days.map((d) => {
            const on = d.key === pick.key;
            return (
              <Pressable
                key={d.key}
                onPress={() => setPick(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{ paddingHorizontal: 14, minHeight: 40, justifyContent: "center", borderRadius: radius.lg, borderWidth: 1, borderColor: on ? color.accent : color.edgeSoft, backgroundColor: on ? color.accent900 : color.surface }}
              >
                <Text size={14} weight={on ? "semibold" : "regular"}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <TextField label="Ville (pour la météo)" value={city} onChangeText={setCity} placeholder="Ex. Lyon" maxLength={80} autoCapitalize="words" />
        <Button label={r ? "D'autres idées" : "Trouver des idées"} variant="primary" block loading={ideas.isPending} needsNetwork onPress={() => ideas.mutate(r && r.day === pick.day ? r.ideas.map((i) => i.title) : [])} />

        {r?.weather ? (
          <Card row style={{ alignItems: "center", gap: space.md }}>
            <Text size={34}>{r.weather.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text weight="semibold">
                {r.weather.label} {r.city ? `à ${r.city}` : ""}
              </Text>
              <Text size={13} tone="muted">
                {r.weather.tMin}° à {r.weather.tMax}° · pluie {r.weather.rain} %
              </Text>
            </View>
          </Card>
        ) : null}

        {r?.ideas.map((i) => {
          const done = added.includes(i.title);
          return (
            <Card key={i.title} style={{ gap: space.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Text size={28}>{i.emoji}</Text>
                <Text weight="semibold" size={16} style={{ flex: 1 }}>
                  {i.title}
                </Text>
              </View>
              <Text size={14} tone="muted">
                {i.description}
              </Text>
              <Text size={12} tone="faint">
                {i.place === "dedans" ? "🏠 Dedans" : "🌳 Dehors"} · {i.cost === "gratuit" ? "Gratuit" : i.cost} · {i.start} – {endOf(i.start, i.minutes)}
              </Text>
              <Button label={done ? "Ajouté au planning ✓" : "Ajouter au planning"} variant={done ? "ghost" : "secondary"} disabled={done} loading={create.isPending && create.variables?.title === `${i.emoji} ${i.title}`} onPress={() => add(i)} />
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
