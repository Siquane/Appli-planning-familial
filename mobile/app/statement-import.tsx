import { useState } from "react";
import { View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { TopBar } from "../src/components/TopBar";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { Chip } from "../src/components/Chip";
import { ChipPicker } from "../src/components/ChipPicker";
import { CheckIcon, DocumentIcon, PiggyBankIcon, SparkleIcon, WarningIcon } from "../src/components/icons";
import { MoreLink } from "../src/components/MoreLink";
import { useExpenseCategories, useImportStatement, useParseStatement, usePlan } from "../src/hooks/useApi";
import { useSlowHint } from "../src/hooks/useSlowHint";
import { categoryLabel, formatEuros } from "../src/lib/money";
import { budgetOfferLabel, hasBudgetPack, showApiError } from "../src/lib/premium";
import { formatDay, importLabel, importedMessage, initialReview, selectedCount, selectedTotal, toImportPayload, type ReviewRow } from "../src/lib/statementImport";
import { useToastStore } from "../src/state/toastStore";
import { color, space, gutter } from "../src/theme/tokens";
import type { StatementParse } from "../src/api/types";

const MAX_PDF_BYTES = 6 * 1024 * 1024;

// Budget+: import a bank statement (PDF). The server reads it in memory and
// forgets it; here the family checks what was found, fixes categories, and
// only what is ticked goes into the budget.
export default function StatementImportScreen() {
  const { data: plan } = usePlan();
  const premium = hasBudgetPack(plan);
  const parse = useParseStatement();
  const save = useImportStatement();
  const { options } = useExpenseCategories();
  const slow = useSlowHint(parse.isPending);

  const [result, setResult] = useState<StatementParse | null>(null);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [editing, setEditing] = useState<number | null>(null);

  async function onPick() {
    if (!premium) return router.push("/premium");
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets[0]) return;
      const file = picked.assets[0];
      if (file.size && file.size > MAX_PDF_BYTES) return useToastStore.getState().show("Ce fichier est trop lourd (6 Mo au plus).");
      const blob = await (await fetch(file.uri)).blob();
      const data = await parse.mutateAsync(blob);
      setResult(data);
      setReview(initialReview(data.rows));
      setEditing(null);
    } catch (e) {
      showApiError(e);
    }
  }

  const patch = (id: number, change: Partial<ReviewRow>) => setReview((list) => list.map((r) => (r.row.id === id ? { ...r, ...change } : r)));
  const count = selectedCount(review);

  async function onSave() {
    if (count === 0) return;
    try {
      const out = await save.mutateAsync(toImportPayload(review));
      useToastStore.getState().show(importedMessage(out.imported, out.recurringCreated));
      router.back();
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Importer un relevé" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        {!result && (
          <>
            {!premium && (
              <Pressable onPress={() => router.push("/premium")}>
                <Card style={{ gap: space.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <PiggyBankIcon size={22} color={color.pillar3} />
                    <Text size={13} weight="medium">
                      Budget+
                    </Text>
                  </View>
                  <Text size={13} tone="muted">
                    Importe ton relevé de compte en PDF : tes dépenses sont retrouvées, classées et ajoutées au budget.
                  </Text>
                  <MoreLink label={budgetOfferLabel(plan)} />
                </Card>
              </Pressable>
            )}
            <Card style={{ gap: space.sm }}>
              <Text size={15} weight="medium">
                Comment ça marche
              </Text>
              <Text size={13} tone="muted">
                1. Télécharge le relevé PDF sur le site de ta banque.{"\n"}2. Choisis-le ici : l'appli retrouve les dépenses et propose une catégorie à chacune.{"\n"}3. Tu vérifies, tu corriges si besoin, et tu importes ce que tu as coché.
              </Text>
            </Card>
            <Card style={{ gap: space.xs }}>
              <Text size={13} weight="medium">
                Ta confidentialité
              </Text>
              <Text size={13} tone="muted">
                Le PDF est lu par notre serveur le temps de l'analyse, puis oublié : il n'est jamais enregistré, ni envoyé à une autre entreprise. Seules les dépenses que tu coches sont conservées.
              </Text>
            </Card>
            <Button
              label={parse.isPending ? "Lecture du relevé…" : premium ? "Choisir un relevé PDF" : "Choisir un relevé PDF · Budget+"}
              icon={<DocumentIcon size={18} color={color.bg} />}
              variant="primary"
              block
              loading={parse.isPending}
              onPress={onPick}
            />
            {slow && (
              <Text size={13} tone="faint" center>
                Le serveur se réveille, ça peut prendre une minute.
              </Text>
            )}
          </>
        )}

        {result && (
          <>
            <Card style={{ gap: space.xs }}>
              <Text size={15} weight="medium">
                {result.rows.length} dépense{result.rows.length > 1 ? "s" : ""} trouvée{result.rows.length > 1 ? "s" : ""} · {formatEuros(result.check.readDebitsCents)}
              </Text>
              {result.check.ok === true && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                  <CheckIcon size={16} color={color.success} />
                  <Text size={13} tone="muted">
                    Le total correspond à celui du relevé.
                  </Text>
                </View>
              )}
              {result.check.ok === false && (
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xs }}>
                  <WarningIcon size={16} color={color.danger} />
                  <Text size={13} tone="danger" style={{ flex: 1 }}>
                    Le total lu ({formatEuros(result.check.readDebitsCents)}) ne correspond pas à celui du relevé ({formatEuros(result.check.expectedDebitsCents ?? 0)}) : il manque peut-être une ligne.
                  </Text>
                </View>
              )}
              {result.ignoredCredits.count > 0 && (
                <Text size={13} tone="faint">
                  {result.ignoredCredits.count} entrée{result.ignoredCredits.count > 1 ? "s" : ""} d'argent ({formatEuros(result.ignoredCredits.totalCents)}) ignorée{result.ignoredCredits.count > 1 ? "s" : ""} : le budget ne suit que les dépenses.
                </Text>
              )}
            </Card>

            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Chip label="Tout cocher" size="sm" onPress={() => setReview((l) => l.map((r) => ({ ...r, selected: true })))} />
              <Chip label="Tout décocher" size="sm" onPress={() => setReview((l) => l.map((r) => ({ ...r, selected: false })))} />
            </View>

            {review.map((r) => (
              <Card key={r.row.id} gap={space.sm} style={{ opacity: r.selected ? 1 : 0.6 }}>
                <Pressable
                  onPress={() => patch(r.row.id, { selected: !r.selected })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: r.selected }}
                  accessibilityLabel={`${r.row.label}, ${formatEuros(r.row.amountCents)}, ${formatDay(r.row.date)}`}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 1.5,
                      borderColor: r.selected ? color.pillar3 : color.neutral600,
                      backgroundColor: r.selected ? color.pillar3 : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {r.selected && <CheckIcon size={14} color={color.bg} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text size={15} numberOfLines={1}>
                      {r.row.label}
                    </Text>
                    <Text size={13} tone="faint" numberOfLines={1}>
                      {formatDay(r.row.date)}
                      {r.row.duplicate ? " · déjà dans ton budget" : ""}
                    </Text>
                  </View>
                  <Text size={15} weight="medium">
                    {formatEuros(r.row.amountCents)}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" }}>
                  <Chip
                    label={categoryLabel(options, r.category) + (r.row.source === "default" && r.category === r.row.category ? " ?" : "")}
                    size="sm"
                    selected={editing === r.row.id}
                    onPress={() => setEditing(editing === r.row.id ? null : r.row.id)}
                  />
                  <Chip
                    label="Chaque mois"
                    size="sm"
                    selected={r.recurring}
                    onPress={() => patch(r.row.id, { recurring: !r.recurring, selected: true })}
                  />
                </View>
                {editing === r.row.id && (
                  <ChipPicker
                    label="Catégorie"
                    options={options}
                    selected={r.category}
                    onSelect={(v) => {
                      if (v) patch(r.row.id, { category: v, selected: true });
                      setEditing(null);
                    }}
                  />
                )}
              </Card>
            ))}

            <Button
              label={importLabel(count)}
              icon={<SparkleIcon size={18} color={color.bg} />}
              variant="primary"
              block
              disabled={count === 0}
              loading={save.isPending}
              onPress={onSave}
            />
            {count > 0 && (
              <Text size={13} tone="faint" center>
                Total : {formatEuros(selectedTotal(review))}
              </Text>
            )}
          </>
        )}
      </KeyboardScrollView>
    </Screen>
  );
}
