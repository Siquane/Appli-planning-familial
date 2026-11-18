import { useEffect, useState } from "react";
import { MoreLink } from "../../src/components/MoreLink";
import { PrivateNote } from "../../src/components/PrivateNote";
import { Pressable, hitSlopFor } from "../../src/components/Touchable";
import { ScrollView, Share, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TabHeader } from "../../src/components/PageHeader";
import { CalendarIcon, ChartIcon, ChevronLeftIcon, DocumentIcon, ChevronRightIcon, PlusIcon, RecurringIcon, SparkleIcon, TargetIcon, WarningIcon } from "../../src/components/icons";
import { useDrifts, useExpenseCategories, useForecast, useMembers, useMonthlyBudget, usePlan } from "../../src/hooks/useApi";
import { budgetToCsv, categoryLabel, currentMonth, formatEuros, monthLabel, shiftMonth, shortDay } from "../../src/lib/money";
import { color, radius, space, gutter } from "../../src/theme/tokens";
import { budgetTrial, hasBudgetPack, trialNotice } from "../../src/lib/premium";
import { syncTrialReminder } from "../../src/lib/notifications";
import { EmptyState } from "../../src/components/Playful";

export default function BudgetScreen() {
  const [month, setMonth] = useState(currentMonth());
  const { data, isLoading } = useMonthlyBudget(month);
  const { options } = useExpenseCategories();
  const { data: members = [] } = useMembers();
  const { data: plan } = usePlan();
  const premium = hasBudgetPack(plan);
  const notice = trialNotice(plan);
  const trial = budgetTrial(plan);
  // Keeps the « trial ends soon » reminder in step with the trial (also after a reinstall).
  useEffect(() => {
    if (plan) syncTrialReminder(trial?.active ? trial.endsAt : null);
  }, [plan, trial?.active, trial?.endsAt]);
  const { data: forecast } = useForecast(premium);
  const { data: drifts = [] } = useDrifts(month, premium);
  const expenses = data?.expenses ?? [];
  const byCategory = data?.byCategory ?? [];
  const biggest = Math.max(0, ...byCategory.map((c) => c.totalCents));
  const isCurrent = month === currentMonth();
  const overCount = byCategory.filter((c) => c.limitCents !== null && c.totalCents > c.limitCents).length;

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Budget" />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MonthArrow onPress={() => setMonth(shiftMonth(month, -1))} label="Mois précédent">
            <ChevronLeftIcon size={16} color={color.text} />
          </MonthArrow>
          <Pressable style={{ flex: 1 }} onPress={() => setMonth(currentMonth())} disabled={isCurrent}>
            <Text heading weight="medium" size={17} center>
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

        <PrivateNote what="budget" />
        {notice && (
          <Pressable onPress={() => router.push("/premium")} accessibilityLabel={notice.text}>
            <Card style={{ gap: space.xs, borderWidth: notice.kind === "ending" ? 1 : 0, borderColor: color.accent400 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <SparkleIcon size={18} color={color.accent400} />
                <Text size={13} weight="medium" tone={notice.kind === "ending" ? "accent" : "text"} style={{ flex: 1 }}>
                  {notice.text}
                </Text>
              </View>
              <MoreLink label={notice.kind === "offer" ? "Essayer maintenant" : "Voir Budget+"} />
            </Card>
          </Pressable>
        )}

        <Card style={{ alignItems: "center", paddingVertical: space.lg }}>
          <Text size={13} tone="muted">
            Total du mois
          </Text>
          <Text heading weight="semibold" size={28}>
            {formatEuros(data?.totalCents ?? 0)}
          </Text>
          <Text size={11} tone="faint">
            {expenses.length} dépense{expenses.length !== 1 ? "s" : ""}
          </Text>
          {overCount > 0 && (
            <Text size={13} tone="danger" style={{ marginTop: space.sm }}>
              {overCount === 1 ? "1 plafond dépassé" : `${overCount} plafonds dépassés`}
            </Text>
          )}
        </Card>

        {premium && isCurrent && forecast && (
          <Card style={{ gap: space.xs }}>
            <Text size={13} tone="muted">
              Prévision de fin de mois
            </Text>
            <Text size={15} weight="medium">
              À ce rythme, environ {formatEuros(roundEuros(forecast.projectedCents))}
            </Text>
            {forecast.upcomingRecurringCents > 0 && (
              <Text size={13} tone="faint">
                Dont {formatEuros(forecast.upcomingRecurringCents)} de dépenses récurrentes encore à venir
              </Text>
            )}
            {forecast.usualCents !== null && (
              <Text size={13} tone={forecast.projectedCents > forecast.usualCents * 1.05 ? "danger" : "faint"}>
                {forecast.projectedCents > forecast.usualCents * 1.05
                  ? `Plus que d'habitude (${formatEuros(roundEuros(forecast.usualCents))} en moyenne)`
                  : `D'habitude : ${formatEuros(roundEuros(forecast.usualCents))} en moyenne`}
              </Text>
            )}
          </Card>
        )}

        {premium && drifts.length > 0 && (
          <Card style={{ gap: space.xs, borderWidth: 1, borderColor: color.accent400 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <WarningIcon size={18} color={color.accent400} />
              <Text size={15} weight="medium">
                Dépenses en hausse
              </Text>
            </View>
            {drifts.map((d) => (
              <Text key={d.category} size={13} tone="muted">
                {categoryLabel(options, d.category)} : {formatEuros(d.totalCents)}, +{d.increasePct} % (d'habitude {formatEuros(d.averageCents)})
              </Text>
            ))}
            <Text size={11} tone="faint">
              Comparé à la moyenne des 3 mois précédents.
            </Text>
          </Card>
        )}

        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            label="Ajouter une dépense"
            icon={<PlusIcon size={18} color={color.text} />}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push(`/expense/new?month=${month}`)}
          />
          <Button label="Réglages" variant="ghost" onPress={() => router.push("/budget-settings")} />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            label="Bilan & export"
            icon={<ChartIcon size={17} color={color.pillar3} />}
            trailing={premium ? undefined : <SparkleIcon size={14} color={color.accent400} />}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push("/budget-report")}
          />
          <Button
            label="Épargne"
            icon={<TargetIcon size={17} color={color.pillar3} />}
            trailing={premium ? undefined : <SparkleIcon size={14} color={color.accent400} />}
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.push("/savings")}
          />
        </View>
        <Button
          label="Calendrier des prélèvements"
          icon={<CalendarIcon size={17} color={color.pillar3} />}
          trailing={premium ? undefined : <SparkleIcon size={14} color={color.accent400} />}
          variant="secondary"
          block
          onPress={() => router.push(`/debits?month=${month}`)}
        />
        <Button
          label="Importer un relevé"
          icon={<DocumentIcon size={18} color={color.pillar3} />}
          trailing={premium ? undefined : <SparkleIcon size={14} color={color.accent400} />}
          variant="secondary"
          block
          needsNetwork
          onPress={() => router.push("/statement-import")}
        />

        {expenses.length > 0 && (
          <Button
            label="Exporter le mois (tableur)"
            variant="ghost"
            block
            onPress={() => {
              const csv = budgetToCsv(
                expenses,
                (c) => categoryLabel(options, c),
                (id) => members.find((m) => m.id === id)?.name ?? "",
              );
              Share.share({ title: `Budget ${monthLabel(month)}`, message: csv }).catch(() => {});
            }}
          />
        )}

        {byCategory.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Par catégorie
            </Text>
            <Card style={{ gap: space.md }}>
              {byCategory.map((c) => {
                const over = c.limitCents !== null && c.totalCents > c.limitCents;
                // With a cap the bar shows how much of it is used; without, it's relative to the biggest category.
                const ratio = c.limitCents !== null ? c.totalCents / c.limitCents : biggest ? c.totalCents / biggest : 0;
                return (
                  <View key={c.category} style={{ gap: space.xs }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text size={13}>{categoryLabel(options, c.category)}</Text>
                      <Text size={13} weight="medium" tone={over ? "danger" : "text"}>
                        {formatEuros(c.totalCents)}
                        {c.limitCents !== null && <Text size={13} tone="faint">{` / ${formatEuros(c.limitCents)}`}</Text>}
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
                      <Text size={11} tone="danger">
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
          <Card>
            <EmptyState title="Porte-monnaie au repos 💤" detail="Aucune dépense ce mois-ci. Ajoute la première avec le « + », ou importe un relevé." />
          </Card>
        )}

        {expenses.length > 0 && (
          <View style={{ gap: space.sm }}>
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                        <Text size={15} weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {e.label}
                        </Text>
                        {e.recurringId && <RecurringIcon size={12} color={color.accent400} />}
                      </View>
                      <Text size={11} tone="faint" numberOfLines={1}>
                        {subtitle}
                      </Text>
                    </View>
                    <Text size={15} weight="medium">
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
    <Pressable hitSlop={hitSlopFor(34)}
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
