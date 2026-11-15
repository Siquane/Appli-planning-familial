import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { MoreLink } from "../src/components/MoreLink";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PiggyBankIcon } from "../src/components/icons";
import { useDebits, useExpenseCategories, usePlan } from "../src/hooks/useApi";
import { categoryLabel, currentMonth, formatEuros, monthLabel, shiftMonth } from "../src/lib/money";
import { budgetOfferLabel, hasBudgetPack } from "../src/lib/premium";
import { color, space, gutter } from "../src/theme/tokens";
import type { Debit } from "../src/api/types";

// Budget+ : les dépenses récurrentes (loyer, abonnements…) du mois, jour par
// jour, avec ce qui est déjà passé et ce qui reste à venir.
export default function DebitsScreen() {
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState(params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonth());
  const { data: plan } = usePlan();
  const premium = hasBudgetPack(plan);
  const { data, isLoading } = useDebits(month, premium);
  const { options } = useExpenseCategories();

  if (plan && !premium) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Prélèvements" onBack={() => router.back()} />
        <View style={{ padding: gutter }}>
          <Pressable onPress={() => router.push("/premium")}>
            <Card style={{ gap: space.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <PiggyBankIcon size={22} color={color.pillar3} />
                <Text size={13} weight="medium">
                  Budget+
                </Text>
              </View>
              <Text size={13} tone="muted">
                Tes dépenses récurrentes du mois jour par jour : ce qui est déjà passé et ce qui reste à venir.
              </Text>
              <MoreLink label={budgetOfferLabel(plan)} />
            </Card>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Regroupe les prélèvements par jour.
  const days = new Map<number, Debit[]>();
  for (const d of data?.debits ?? []) days.set(d.day, [...(days.get(d.day) ?? []), d]);

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Prélèvements" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="Mois précédent" style={{ padding: space.sm }}>
            <ChevronLeftIcon size={16} color={color.text} />
          </Pressable>
          <Text heading weight="medium" size={17} center style={{ flex: 1 }}>
            {monthLabel(month)}
          </Text>
          <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="Mois suivant" style={{ padding: space.sm }}>
            <ChevronRightIcon size={16} color={color.text} />
          </Pressable>
        </View>

        {data && (
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Card style={{ flex: 1, gap: space.xs }}>
              <Text size={11} tone="faint">
                Déjà passé
              </Text>
              <Text size={17} weight="semibold" mono>
                {formatEuros(data.passedCents)}
              </Text>
            </Card>
            <Card style={{ flex: 1, gap: space.xs, borderWidth: 1, borderColor: color.pillar3 }}>
              <Text size={11} tone="faint">
                À venir
              </Text>
              <Text size={17} weight="semibold" mono>
                {formatEuros(data.upcomingCents)}
              </Text>
            </Card>
          </View>
        )}

        {!isLoading && data && data.debits.length === 0 && (
          <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.lg }}>
            <CalendarIcon size={26} color={color.neutral600} />
            <Text size={13} tone="muted" center>
              Aucune dépense récurrente ce mois-ci. Ajoute-les dans Budget → Réglages, ou coche « Chaque mois » en important un relevé.
            </Text>
          </Card>
        )}

        {[...days.entries()].map(([day, list]) => (
          <View key={day} style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ width: 40, alignItems: "center", paddingTop: space.sm }}>
              <Text size={17} weight="semibold" mono tone={list[0].passed ? "faint" : "text"}>
                {day}
              </Text>
            </View>
            <Card style={{ flex: 1, gap: space.xs, opacity: list[0].passed ? 0.6 : 1 }}>
              {list.map((d, i) => (
                <View key={`${d.label}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text size={15} numberOfLines={1}>
                      {d.label}
                    </Text>
                    <Text size={11} tone="faint">
                      {categoryLabel(options, d.category)}
                      {d.passed ? " · passé" : ""}
                    </Text>
                  </View>
                  <Text size={15} mono>
                    {formatEuros(d.amountCents)}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
