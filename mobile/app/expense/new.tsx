import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { DateField } from "../../src/components/DateField";
import { Chip } from "../../src/components/Chip";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useCreateExpense, useDeleteExpense, useMonthlyBudget, useUpdateExpense } from "../../src/hooks/useApi";
import { centsToInput, currentMonth, EXPENSE_CATEGORIES, fromDayString, parseAmount, toDayString } from "../../src/lib/money";
import { useToastStore } from "../../src/state/toastStore";
import { space } from "../../src/theme/tokens";
import type { ExpenseCategory } from "../../src/api/types";

// New expense, or edit/delete with ?edit=<id>&month=<YYYY-MM> (the month the
// expense was listed under, so it can be found in that month's cache).
export default function ExpenseFormScreen() {
  const params = useLocalSearchParams<{ edit?: string; month?: string }>();
  const month = params.month ?? currentMonth();
  const { data } = useMonthlyBudget(month);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const existing = useMemo(() => data?.expenses.find((e) => e.id === params.edit), [data, params.edit]);

  // A new expense defaults to today, or to the 1st of the month being viewed when browsing another month.
  const [date, setDate] = useState<Date>(() => (month === currentMonth() ? new Date() : fromDayString(`${month}-01`)));
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("courses");

  useEffect(() => {
    if (!existing) return;
    setLabel(existing.label);
    setAmount(centsToInput(existing.amountCents));
    setCategory(existing.category);
    setDate(fromDayString(existing.date));
  }, [existing]);

  const amountCents = parseAmount(amount);
  const isValid = label.trim().length > 0 && amountCents !== null;
  const saving = createExpense.isPending || updateExpense.isPending;

  async function onSave() {
    if (amountCents === null) return;
    const payload = { label: label.trim(), amountCents, category, date: toDayString(date) };
    try {
      if (existing) {
        await updateExpense.mutateAsync({ id: existing.id, data: payload });
        useToastStore.getState().show("Dépense modifiée.");
      } else {
        await createExpense.mutateAsync(payload);
        useToastStore.getState().show("Dépense ajoutée.");
      }
      router.back();
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert("Supprimer la dépense", `Supprimer « ${existing.label} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          deleteExpense.mutate(existing.id, {
            onSuccess: () => {
              useToastStore.getState().show("Dépense supprimée.");
              router.back();
            },
          }),
      },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Modifier la dépense" : "Nouvelle dépense"} onBack={() => router.back()} onDelete={existing ? onDelete : undefined} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TextField label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="Ex. 42,50" keyboardType="decimal-pad" />

        <TextField label="Libellé" value={label} onChangeText={setLabel} placeholder="Ex. Supermarché" />

        <View style={{ gap: space[2] }}>
          <Text size={13} tone="muted">
            Catégorie
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c.value} label={c.label} size="sm" selected={category === c.value} onPress={() => setCategory(c.value)} />
            ))}
          </View>
        </View>

        <DateField label="Date" value={date} onChange={setDate} />

        {!isValid && (
          <Text tone="muted" size={12} center>
            {amount && amountCents === null ? "Montant invalide (ex. 42,50)." : "Un montant et un libellé sont nécessaires."}
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Ajouter la dépense"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </ScrollView>
    </Screen>
  );
}
