import { View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useIsChildAccount } from "../state/authStore";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { Card } from "./Card";
import { color, space } from "../theme/tokens";

export type PendingCervelleQuiz = { id: string; learnerName: string; revisionTitle: string; createdAt: string };

// « Apprends-le à papa/maman » : les quiz que les enfants ont préparés dans
// Cervelle et qui attendent une réponse d'un parent. Rien s'il n'y en a pas.
export function CervelleQuizCard() {
  const isChild = useIsChildAccount();
  const { data } = useQuery({
    queryKey: ["cervelleQuizzes"],
    queryFn: () => api.get<{ quizzes: PendingCervelleQuiz[] }>("/cervelle/teach/pending").then((r) => r.quizzes),
    enabled: !isChild,
    refetchInterval: 120_000,
  });
  if (!data?.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      {data.map((q) => (
        <Pressable key={q.id} onPress={() => router.push(`/cervelle-quiz/${q.id}`)} accessibilityRole="button" accessibilityLabel={`${q.learnerName} t'a préparé un quiz sur ${q.revisionTitle}`}>
          <Card row style={{ alignItems: "center", gap: space.md, borderColor: color.accent700, borderWidth: 1 }}>
            <Text size={28}>🧠</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text weight="semibold" size={15}>
                {q.learnerName} t'a préparé un quiz
              </Text>
              <Text size={13} tone="muted" numberOfLines={1}>
                {q.revisionTitle} · 5 questions
              </Text>
            </View>
            <Text tone="accent" weight="semibold" size={14}>
              Répondre
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
