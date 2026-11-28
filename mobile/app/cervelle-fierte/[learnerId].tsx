import { useEffect } from "react";
import { ScrollView, Share, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "../../src/api/client";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { color, gutter, space } from "../../src/theme/tokens";

// « Journal de fierté » qu'un enfant envoie depuis Cervelle le dimanche : ce
// qu'il a appris, ce dont il est fier, ses jours de travail. Pas de note.

type Pride = {
  name: string;
  week: string;
  to: string;
  learned: { day: string; text: string }[];
  proud: { day: string; text: string }[];
  notions: string[];
  activeDays: number;
  minutes: number;
  badges: string[];
  message: string;
  sharePath: string | null;
};

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", gap: 2, paddingVertical: space.md }}>
      <Text heading size={24} weight="semibold" tone="accent">
        {value}
      </Text>
      <Text size={12} tone="muted" center>
        {label}
      </Text>
    </Card>
  );
}

export default function CervellePrideScreen() {
  const { learnerId, week } = useLocalSearchParams<{ learnerId: string; week?: string }>();
  const { data, error } = useQuery({
    queryKey: ["cervellePride", learnerId, week ?? ""],
    queryFn: () => api.get<{ pride: Pride }>(`/cervelle/learners/${learnerId}/pride${week ? `?week=${week}` : ""}`).then((r) => r.pride),
    enabled: !!learnerId,
  });

  useEffect(() => {
    if (data) api.post(`/cervelle/learners/${learnerId}/pride/seen${week ? `?week=${week}` : ""}`, {}).catch(() => undefined);
  }, [data]);

  if (!data) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Journal de fierté" onBack={() => router.back()} />
        {error ? (
          <View style={{ padding: gutter }}>
            <Text tone="muted">Cette page n'est plus disponible.</Text>
          </View>
        ) : null}
      </Screen>
    );
  }
  const p = data;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={`La semaine de ${p.name}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.md }}>
        <Text tone="muted" size={14}>
          Du {dayLabel(p.week)} au {dayLabel(p.to)}. {p.name} t'envoie sa page de la semaine.
        </Text>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Stat value={p.activeDays} label={p.activeDays > 1 ? "jours de travail" : "jour de travail"} />
          <Stat value={p.notions.length} label={p.notions.length > 1 ? "notions apprises" : "notion apprise"} />
          <Stat value={p.minutes} label="minutes" />
        </View>
        {p.message ? (
          <Card style={{ borderLeftWidth: 3, borderLeftColor: color.accent500 }}>
            <Text size={15}>« {p.message} »</Text>
          </Card>
        ) : null}
        {p.notions.length ? (
          <Card style={{ gap: space.xs }}>
            <Text weight="medium">Ce que {p.name} a appris</Text>
            {p.notions.map((n) => (
              <Text key={n} size={14}>
                ✓ {n}
              </Text>
            ))}
          </Card>
        ) : null}
        {p.learned.length ? (
          <Card style={{ gap: space.xs }}>
            <Text weight="medium">Dans son journal : « j'ai appris… »</Text>
            {p.learned.map((x) => (
              <Text key={x.day} size={14}>
                • {x.text}
              </Text>
            ))}
          </Card>
        ) : null}
        {p.proud.length ? (
          <Card style={{ gap: space.xs }}>
            <Text weight="medium">Ses fiertés de la semaine</Text>
            {p.proud.map((x) => (
              <Text key={x.day} size={14}>
                • {x.text}
              </Text>
            ))}
          </Card>
        ) : null}
        {p.badges.length ? (
          <Card style={{ gap: space.xs }}>
            <Text weight="medium">Badges gagnés</Text>
            <Text size={14}>{p.badges.join(", ")}</Text>
          </Card>
        ) : null}
        {p.sharePath ? (
          <Button label="Partager avec la famille (lien)" variant="secondary" block onPress={() => Share.share({ message: `Le journal de fierté de ${p.name} : ${API_URL.replace(/\/$/, "")}${p.sharePath}` }).catch(() => undefined)} />
        ) : null}
        <Button label="Fermer" block onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
