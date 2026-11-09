import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ChevronLeftIcon, ChevronRightIcon, WalletIcon } from "../src/components/icons";
import { useMonthlyBudget } from "../src/hooks/useApi";
import { currentMonth, expenseCategoryLabel, formatEuros, monthLabel, shiftMonth, shortDay } from "../src/lib/money";
import { color, radius, space } from "../src/theme/tokens";

export default function BudgetScreen() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading } = useMonthlyBudget(month);
  const expenses = data?.expenses ?? [];
  const byCategory = data?.byCategory ?? [];
  const biggest = byCategory[0]?.totalCents ?? 0;
  const isCurrent = month === currentMonth();

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Budget" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MonthArrow onPress={() => setMonth(shiftMonth(month, -1))} label="Mois précédent">
            <ChevronLeftIcon size={16} color={color.text} />
          </MonthArrow>
          <Pressable style={{ flex: 1 }} onPress={() => setMonth(currentMonth())} disabled={isCurrent}>
            <Text heading weight="medium" size={16} center>
              {monthLabel(month)}
            </Text>
            {!isCurrent && (
              <Text size={11} tone="faint" center>
                Revenir au mois en cours
              </Text>
            )}
          </Pressable>
          <MonthArrow onPress={() => setMonth(shiftMonth(month, 1))} label="Mois suivant">
            <ChevronRightIcon size={16} color={color.text} />
          </MonthArrow>
        </View>

        <Card style={{ alignItems: "center", paddingVertical: space[6] }}>
          <Text size={12} tone="muted">
            Total du mois
          </Text>
          <Text heading weight="semibold" size={28}>
            {formatEuros(data?.totalCents ?? 0)}
          </Text>
          <Text size={11.5} tone="faint">
            {expenses.length} dépense{expenses.length !== 1 ? "s" : ""}
          </Text>
        </Card>

        <Button label="+ Ajouter une dépense" variant="secondary" block onPress={() => router.push(`/expense/new?month=${month}`)} />

        {byCategory.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Par catégorie
            </Text>
            <Card style={{ gap: space[4] }}>
              {byCategory.map((c) => (
                <View key={c.category} style={{ gap: space[1] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text size={13}>{expenseCategoryLabel(c.category)}</Text>
                    <Text size={13} weight="medium">
                      {formatEuros(c.totalCents)}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: color.neutral800 }}>
                    <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: color.accent400, width: `${biggest ? Math.max(2, (c.totalCents / biggest) * 100) : 0}%` }} />
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        {!isLoading && expenses.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
            <WalletIcon size={22} color={color.neutral600} />
            <Text tone="muted" size={13} center style={{ marginTop: space[2] }}>
              Aucune dépense ce mois-ci.
            </Text>
          </Card>
        )}

        {expenses.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Dépenses
            </Text>
            {expenses.map((e) => (
              <Pressable key={e.id} onPress={() => router.push(`/expense/new?edit=${e.id}&month=${month}`)}>
                <Card row style={{ alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text size={14} weight="medium" numberOfLines={1}>
                      {e.label}
                    </Text>
                    <Text size={11.5} tone="faint">
                      {expenseCategoryLabel(e.category)} · {shortDay(e.date)}
                    </Text>
                  </View>
                  <Text size={14} weight="medium">
                    {formatEuros(e.amountCents)}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function MonthArrow({ onPress, label, children }: { onPress: () => void; label: string; children: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: color.divider, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </Pressable>
  );
}
