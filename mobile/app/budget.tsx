import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ChevronLeftIcon, ChevronRightIcon, RecurringIcon, WalletIcon } from "../src/components/icons";
import { useExpenseCategories, useForecast, useMembers, useMonthlyBudget, usePlan } from "../src/hooks/useApi";
import { categoryLabel, currentMonth, formatEuros, monthLabel, shiftMonth, shortDay } from "../src/lib/money";
import { color, radius, space } from "../src/theme/tokens";
import { hasBudgetPack } from "../src/lib/premium";

export default function BudgetScreen() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading } = useMonthlyBudget(month);
  const { options } = useExpenseCategories();
  const { data: members = [] } = useMembers();
  const premium = hasBudgetPack(usePlan().data);
  const { data: forecast } = useForecast(premium);
  const expenses = data?.expenses ?? [];
  const byCategory = data?.byCategory ?? [];
  const biggest = Math.max(0, ...byCategory.map((c) => c.totalCents));
  const isCurrent = month === currentMonth();
  const overCount = byCategory.filter((c) => c.limitCents !== null && c.totalCents > c.limitCents).length;

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
          {overCount > 0 && (
            <Text size={12} tone="danger" style={{ marginTop: space[2] }}>
              {overCount === 1 ? "1 plafond dépassé" : `${overCount} plafonds dépassés`}
            </Text>
          )}
        </Card>

        {premium && isCurrent && forecast && (
          <Card style={{ gap: space[1] }}>
            <Text size={12} tone="muted">
              Prévision de fin de mois
            </Text>
            <Text size={15} weight="medium">
              À ce rythme, environ {formatEuros(roundEuros(forecast.projectedCents))}
            </Text>
            {forecast.upcomingRecurringCents > 0 && (
              <Text size={12} tone="faint">
                Dont {formatEuros(forecast.upcomingRecurringCents)} de dépenses récurrentes encore à venir
              </Text>
            )}
            {forecast.usualCents !== null && (
              <Text size={12} tone={forecast.projectedCents > forecast.usualCents * 1.05 ? "danger" : "faint"}>
                {forecast.projectedCents > forecast.usualCents * 1.05
                  ? `Au-dessus de d'habitude (${formatEuros(roundEuros(forecast.usualCents))} en moyenne)`
                  : `D'habitude : ${formatEuros(roundEuros(forecast.usualCents))} en moyenne`}
              </Text>
            )}
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Button label="+ Ajouter une dépense" variant="secondary" style={{ flex: 1 }} onPress={() => router.push(`/expense/new?month=${month}`)} />
          <Button label="Réglages" variant="ghost" onPress={() => router.push("/budget-settings")} />
        </View>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Button label={premium ? "📈 Bilan & export" : "📈 Bilan & export ✨"} variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/budget-report")} />
          <Button label={premium ? "🎯 Épargne" : "🎯 Épargne ✨"} variant="secondary" style={{ flex: 1 }} onPress={() => router.push("/savings")} />
        </View>

        {byCategory.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Par catégorie
            </Text>
            <Card style={{ gap: space[4] }}>
              {byCategory.map((c) => {
                const over = c.limitCents !== null && c.totalCents > c.limitCents;
                // With a cap the bar shows how much of it is used; without, it's relative to the biggest category.
                const ratio = c.limitCents !== null ? c.totalCents / c.limitCents : biggest ? c.totalCents / biggest : 0;
                return (
                  <View key={c.category} style={{ gap: space[1] }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text size={13}>{categoryLabel(options, c.category)}</Text>
                      <Text size={13} weight="medium" tone={over ? "danger" : "text"}>
                        {formatEuros(c.totalCents)}
                        {c.limitCents !== null && <Text size={12} tone="faint">{` / ${formatEuros(c.limitCents)}`}</Text>}
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: color.neutral800, overflow: "hidden" }}>
                      <View
                        style={{
                          height: 6,
                          borderRadius: radius.sm,
                          backgroundColor: over ? color.danger : color.accent400,
                          width: `${c.totalCents > 0 ? Math.max(2, Math.min(1, ratio) * 100) : 0}%`,
                        }}
                      />
                    </View>
                    {over && (
                      <Text size={11.5} tone="danger">
                        Dépassé de {formatEuros(c.totalCents - c.limitCents!)}
                      </Text>
                    )}
                  </View>
                );
              })}
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
            {expenses.map((e) => {
              const member = e.memberId ? members.find((m) => m.id === e.memberId) : undefined;
              const subtitle = [categoryLabel(options, e.category), member?.name, shortDay(e.date)].filter(Boolean).join(" · ");
              return (
                <Pressable key={e.id} onPress={() => router.push(`/expense/new?edit=${e.id}&month=${month}`)}>
                  <Card row style={{ alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                        <Text size={14} weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {e.label}
                        </Text>
                        {e.recurringId && <RecurringIcon size={12} color={color.accent400} />}
                      </View>
                      <Text size={11.5} tone="faint" numberOfLines={1}>
                        {subtitle}
                      </Text>
                    </View>
                    <Text size={14} weight="medium">
                      {formatEuros(e.amountCents)}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
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

/** A forecast is an estimate: show whole tens of euros. */
function roundEuros(cents: number) {
  return Math.round(cents / 1000) * 1000;
}
