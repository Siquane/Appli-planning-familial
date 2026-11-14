import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { TextField } from "../../src/components/TextField";
import { ChipPicker } from "../../src/components/ChipPicker";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import {
  useCreateRecurringExpense,
  useDeleteRecurringExpense,
  useExpenseCategories,
  useMembers,
  useRecurringExpenses,
  useUpdateRecurringExpense,
} from "../../src/hooks/useApi";
import { centsToInput, parseAmount } from "../../src/lib/money";
import { useToastStore } from "../../src/state/toastStore";
import { space } from "../../src/theme/tokens";

/** "5" -> 5, anything outside 1–31 -> null. */
function parseDay(input: string) {
  if (!/^\d{1,2}$/.test(input.trim())) return null;
  const day = Number(input);
  return day >= 1 && day <= 31 ? day : null;
}

// Rent, subscriptions…: added to the budget every month on the chosen day.
export default function RecurringExpenseFormScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { data: recurring = [] } = useRecurringExpenses();
  const { options } = useExpenseCategories();
  const { data: members = [] } = useMembers();
  const create = useCreateRecurringExpense();
  const update = useUpdateRecurringExpense();
  const remove = useDeleteRecurringExpense();
  const existing = useMemo(() => recurring.find((r) => r.id === edit), [recurring, edit]);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [category, setCategory] = useState<string>("logement");
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setLabel(existing.label);
    setAmount(centsToInput(existing.amountCents));
    setDay(String(existing.dayOfMonth));
    setCategory(existing.category);
    setMemberId(existing.memberId);
  }, [existing]);

  const amountCents = parseAmount(amount);
  const dayOfMonth = parseDay(day);
  const isValid = label.trim().length > 0 && amountCents !== null && dayOfMonth !== null;
  const saving = create.isPending || update.isPending;

  async function onSave() {
    if (amountCents === null || dayOfMonth === null) return;
    const payload = { label: label.trim(), amountCents, dayOfMonth, category, memberId };
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, data: payload });
        useToastStore.getState().show("Dépense récurrente modifiée.");
      } else {
        await create.mutateAsync(payload);
        useToastStore.getState().show("Dépense récurrente ajoutée.");
      }
      router.back();
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert("Arrêter la dépense récurrente", `« ${existing.label} » ne sera plus ajoutée les mois suivants. Les mois déjà passés gardent leur dépense.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Arrêter",
        style: "destructive",
        onPress: () =>
          remove.mutate(existing.id, {
            onSuccess: () => {
              useToastStore.getState().show("Dépense récurrente arrêtée.");
              router.back();
            },
          }),
      },
    ]);
  }

  let hint: string | null = null;
  if (!isValid) {
    if (amount && amountCents === null) hint = "Montant invalide (ex. 42,50).";
    else if (dayOfMonth === null) hint = "Le jour doit être entre 1 et 31.";
    else hint = "Un montant et un libellé sont nécessaires.";
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Dépense récurrente" : "Nouvelle dépense récurrente"} onBack={() => router.back()} onDelete={existing ? onDelete : undefined} />
      <KeyboardScrollView contentContainerStyle={{ padding: 22, gap: space[4] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card>
          <Text size={12} tone="muted">
            Ajoutée automatiquement chaque mois, à partir de ce mois-ci. Un jour 29, 30 ou 31 passe au dernier jour des mois plus courts.
            {existing ? " Les changements s'appliquent aux mois pas encore ajoutés." : ""}
          </Text>
        </Card>

        <TextField label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="Ex. 850" keyboardType="decimal-pad" />

        <TextField label="Libellé" value={label} onChangeText={setLabel} placeholder="Ex. Loyer" />

        <TextField label="Jour du mois" value={day} onChangeText={setDay} placeholder="1 à 31" keyboardType="number-pad" maxLength={2} />

        <ChipPicker label="Catégorie" options={options} selected={category} onSelect={(v) => v && setCategory(v)} />

        {members.length > 0 && (
          <ChipPicker label="Pour qui ? (optionnel)" options={members.map((m) => ({ value: m.id, label: m.name }))} selected={memberId} onSelect={setMemberId} optional />
        )}

        {hint && (
          <Text tone="muted" size={12} center>
            {hint}
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Ajouter"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
