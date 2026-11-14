import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { PiggyBankIcon } from "../src/components/icons";
import { MoreLink } from "../src/components/MoreLink";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { useBudgetReport, useExpenseCategories, usePlan } from "../src/hooks/useApi";
import { categoryLabel, formatEuros, monthLabel, shortMonthLabel } from "../src/lib/money";
import { compareMonths } from "../src/lib/report";
import { hasBudgetPack } from "../src/lib/premium";
import { Chip } from "../src/components/Chip";
import { Button } from "../src/components/Button";
import { EXPORT_PERIODS, exportExpenses, type ExportFormat, type ExportPeriod } from "../src/lib/exportExpenses";
import { useToastStore } from "../src/state/toastStore";
import { color, radius, space } from "../src/theme/tokens";

const CHART_HEIGHT = 140;

// Premium: the last 6 months at a glance (one bar per month, tap a bar to see
// that month) and what changed compared to the month before.
export default function BudgetReportScreen() {
  const { data: plan } = usePlan();
  const premium = hasBudgetPack(plan);
  const { data: months = [], isLoading } = useBudgetReport(6, premium);
  const { options } = useExpenseCategories();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (months.length && selected === null) setSelected(months.length - 1);
  }, [months, selected]);

  if (plan && !premium) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Bilan du budget" onBack={() => router.back()} />
        <View style={{ padding: 18 }}>
          <Pressable onPress={() => router.push("/premium")}>
            <Card style={{ gap: space[1] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                <PiggyBankIcon size={22} color={color.pillar3} />
                <Text size={13} weight="medium">
                  Budget+
                </Text>
              </View>
              <Text size={12} tone="muted">
                Tes dépenses sur 6 mois en un coup d'œil, et ce qui a changé d'un mois à l'autre.
              </Text>
              <MoreLink label="Voir Budget+" />
            </Card>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const max = Math.max(1, ...months.map((m) => m.totalCents));
  const current = selected !== null ? months[selected] : undefined;
  const previous = selected !== null && selected > 0 ? months[selected - 1] : undefined;
  const changes = current && previous ? compareMonths(current, previous).slice(0, 5) : [];
  const totalDelta = current && previous ? current.totalCents - previous.totalCents : null;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Bilan du budget" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: space[3] }}>
          <Text size={13} tone="muted">
            Dépenses par mois
          </Text>
          {!isLoading && (
            <View accessibilityRole="summary" style={{ flexDirection: "row", alignItems: "flex-end", height: CHART_HEIGHT + 34, gap: 2 }}>
              {months.map((m, i) => {
                const h = m.totalCents > 0 ? Math.max(4, (m.totalCents / max) * CHART_HEIGHT) : 0;
                const isSel = i === selected;
                return (
                  <Pressable
                    key={m.month}
                    onPress={() => setSelected(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${monthLabel(m.month)} : ${formatEuros(m.totalCents)}`}
                    style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}
                  >
                    {isSel && (
                      <Text size={10.5} weight="medium" numberOfLines={1}>
                        {formatEuros(m.totalCents).replace(/,\d\d /, " ")}
                      </Text>
                    )}
                    <View
                      style={{
                        width: "62%",
                        height: h,
                        marginTop: 4,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        backgroundColor: isSel ? color.accent400 : color.neutral600,
                      }}
                    />
                    <View style={{ height: 1, alignSelf: "stretch", backgroundColor: color.divider }} />
                    <Text size={10.5} tone={isSel ? "text" : "faint"} style={{ marginTop: 4 }}>
                      {shortMonthLabel(m.month)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>

        {current && (
          <Card style={{ gap: space[1] }}>
            <Text size={12} tone="muted" style={{ textTransform: "capitalize" }}>
              {monthLabel(current.month)}
            </Text>
            <Text heading weight="semibold" size={24}>
              {formatEuros(current.totalCents)}
            </Text>
            {totalDelta !== null && previous!.totalCents > 0 && (
              <Text size={12} tone={totalDelta > 0 ? "danger" : "accent"}>
                {totalDelta > 0 ? "▲" : "▼"} {formatEuros(Math.abs(totalDelta))} par rapport à {monthLabel(previous!.month)}
              </Text>
            )}
          </Card>
        )}

        {changes.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Ce qui a le plus changé
            </Text>
            <Card style={{ gap: space[3] }}>
              {changes.map((c) => (
                <View key={c.category} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text size={13} style={{ flex: 1 }}>
                    {categoryLabel(options, c.category)}
                  </Text>
                  <Text size={13} weight="medium" tone={c.deltaCents > 0 ? "danger" : "accent"}>
                    {c.deltaCents > 0 ? "+" : "−"}
                    {formatEuros(Math.abs(c.deltaCents))}
                    {c.percent !== null ? ` (${c.deltaCents > 0 ? "+" : "−"}${Math.abs(c.percent)} %)` : ""}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {current && current.byCategory.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Répartition du mois
            </Text>
            <Card style={{ gap: space[3] }}>
              {current.byCategory.map((c) => (
                <View key={c.category} style={{ gap: space[1] }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text size={13}>{categoryLabel(options, c.category)}</Text>
                    <Text size={13} weight="medium">
                      {formatEuros(c.totalCents)}
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: color.neutral800, overflow: "hidden" }}>
                    <View
                      style={{
                        height: 6,
                        borderRadius: radius.sm,
                        backgroundColor: color.accent400,
                        width: `${Math.max(2, (c.totalCents / current.totalCents) * 100)}%`,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}

        <ExportSection />
      </ScrollView>
    </Screen>
  );
}

// Budget pack: the month's expenses as a CSV (spreadsheets) or a PDF (to print
// or send to the CAF, the bank…), through the phone's share sheet.
function ExportSection() {
  const [period, setPeriod] = useState<ExportPeriod>("month");
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function onExport(format: ExportFormat) {
    setBusy(format);
    try {
      await exportExpenses(period, format);
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "L'export a échoué.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: space[2] }}>
      <Text weight="medium" size={13} tone="muted">
        Exporter les dépenses
      </Text>
      <Card style={{ gap: space[3] }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
          {EXPORT_PERIODS.map((p) => (
            <Chip key={p.id} label={p.label} size="sm" selected={period === p.id} onPress={() => setPeriod(p.id)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: space[2] }}>
          <Button label="CSV (tableur)" variant="secondary" style={{ flex: 1 }} onPress={() => onExport("csv")} loading={busy === "csv"} disabled={!!busy} />
          <Button label="PDF" variant="secondary" style={{ flex: 1 }} onPress={() => onExport("pdf")} loading={busy === "pdf"} disabled={!!busy} />
        </View>
        <Text size={11.5} tone="faint">
          Pour les impôts, la CAF ou un dossier de prêt : le fichier s'ouvre dans le menu de partage du téléphone.
        </Text>
      </Card>
    </View>
  );
}
