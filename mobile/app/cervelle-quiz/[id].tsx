import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/api/client";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { color, gutter, radius, space } from "../../src/theme/tokens";

// « Apprends-le à papa/maman » : le quiz qu'un enfant a préparé dans Cervelle
// à partir de sa leçon. Le parent répond aux 5 questions ; ensuite il voit les
// bonnes réponses, et l'enfant (prévenu sur son téléphone) peut lui expliquer.

type QuizQuestion = {
  id: string;
  type: string;
  prompt: string;
  choices: string[];
  expected?: number;
  given?: number | null;
  correct?: boolean | null;
  explanation?: string;
};
type TeachQuiz = {
  id: string;
  learnerName: string;
  revisionTitle: string;
  answered: boolean;
  answeredByName: string | null;
  score: number | null;
  total: number;
  questions: QuizQuestion[];
};

export default function CervelleQuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: quiz, error } = useQuery({ queryKey: ["cervelleQuiz", id], queryFn: () => api.get<{ quiz: TeachQuiz }>(`/cervelle/teach/${id}`).then((r) => r.quiz), enabled: !!id });
  const [picks, setPicks] = useState<(number | null)[]>([]);
  const [step, setStep] = useState(0);
  const send = useMutation({
    mutationFn: (answers: number[]) => api.post<{ quiz: TeachQuiz }>(`/cervelle/teach/${id}/answers`, { answers: answers.map(String) }),
    onSuccess: (r) => {
      qc.setQueryData(["cervelleQuiz", id], r.quiz);
      void qc.invalidateQueries({ queryKey: ["cervelleQuizzes"] });
    },
    onError: (e) => useToastStore.getState().show(errorText(e, "envoyer tes réponses")),
  });

  if (!quiz) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Quiz Cervelle" onBack={() => router.back()} />
        {error ? (
          <View style={{ padding: gutter }}>
            <Text tone="muted">Ce quiz n'existe plus. Il a peut-être été supprimé.</Text>
          </View>
        ) : null}
      </Screen>
    );
  }

  const title = `Le quiz de ${quiz.learnerName}`;

  // Déjà répondu : les réponses et les bonnes réponses.
  if (quiz.answered) {
    const left = quiz.total - (quiz.score ?? 0);
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title={title} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.md }}>
          <Card style={{ alignItems: "center", gap: space.xs, paddingVertical: space.lg }}>
            <Text size={34}>{left === 0 ? "🏆" : "🧠"}</Text>
            <Text heading size={24} weight="semibold">
              {quiz.score}/{quiz.total}
            </Text>
            <Text tone="muted" center>
              {left === 0
                ? `Bravo ! ${quiz.learnerName} t'a bien appris sa leçon « ${quiz.revisionTitle} ».`
                : `${quiz.learnerName} a été prévenu : demande-lui de t'expliquer ${left > 1 ? "les réponses" : "la réponse"} que tu n'avais pas.`}
            </Text>
            {quiz.answeredByName ? (
              <Text size={12} tone="faint">
                Répondu par {quiz.answeredByName}
              </Text>
            ) : null}
          </Card>
          {quiz.questions.map((q, i) => (
            <Card key={q.id} style={{ gap: space.xs }}>
              <Text size={12} tone="faint">
                Question {i + 1}
              </Text>
              <Text weight="medium">{q.prompt}</Text>
              <Text size={14} style={{ color: q.correct ? color.success : color.danger }}>
                {q.correct ? "✓" : "✗"} Ta réponse : {q.given !== null && q.given !== undefined ? q.choices[q.given] : "—"}
              </Text>
              {!q.correct && q.expected !== undefined ? (
                <Text size={14} weight="medium">
                  Bonne réponse : {q.choices[q.expected]}
                </Text>
              ) : null}
              {q.explanation ? (
                <Text size={13} tone="muted">
                  {q.explanation}
                </Text>
              ) : null}
            </Card>
          ))}
          <Button label="Fermer" block onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  const q = quiz.questions[step];
  const answers = quiz.questions.map((_, i) => picks[i] ?? null);
  const last = step === quiz.questions.length - 1;
  const chosen = answers[step];

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={title} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.md }}>
        <Text tone="muted" size={14}>
          {quiz.learnerName} a révisé « {quiz.revisionTitle} » et te pose ses questions. À toi de jouer !
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {quiz.questions.map((x, i) => (
            <View key={x.id} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step || answers[i] !== null ? color.accent : color.neutral800 }} />
          ))}
        </View>
        <Text size={12} tone="faint">
          Question {step + 1} sur {quiz.questions.length}
        </Text>
        <Text heading size={20} weight="semibold">
          {q.prompt}
        </Text>
        <View style={{ gap: space.sm }}>
          {q.choices.map((c, i) => {
            const on = chosen === i;
            return (
              <Pressable
                key={i}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setPicks(() => answers.map((a, k) => (k === step ? i : a)))}
                style={{ minHeight: 52, justifyContent: "center", paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: on ? 2 : 1, borderColor: on ? color.accent : color.edgeSoft, backgroundColor: on ? color.accent900 : color.surface }}
              >
                <Text weight={on ? "semibold" : "regular"}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {step > 0 ? <Button label="Précédente" variant="ghost" onPress={() => setStep(step - 1)} /> : null}
          <View style={{ flex: 1 }}>
            {last ? (
              <Button
                label="Envoyer mes réponses"
                variant="primary"
                block
                disabled={answers.some((a) => a === null)}
                loading={send.isPending}
                needsNetwork
                onPress={() => send.mutate(answers as number[])}
              />
            ) : (
              <Button label="Suivante" variant="primary" block disabled={chosen === null} onPress={() => setStep(step + 1)} />
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
