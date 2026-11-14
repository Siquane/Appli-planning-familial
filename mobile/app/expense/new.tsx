import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { TextField } from "../../src/components/TextField";
import { DateField } from "../../src/components/DateField";
import { ChipPicker } from "../../src/components/ChipPicker";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useCreateExpense, useDeleteExpense, useExpenseCategories, useMembers, useMonthlyBudget, useUpdateExpense } from "../../src/hooks/useApi";
import { capCrossed, categoryLabel, centsToInput, currentMonth, formatEuros, fromDayString, parseAmount, toDayString } from "../../src/lib/money";
import { useToastStore } from "../../src/state/toastStore";
import { space, gutter } from "../../src/theme/tokens";
import { errorText } from "../../src/lib/errors";

// New expense, or edit/delete with ?edit=<id>&month=<YYYY-MM> (the month the
// expense was listed under, so it can be found in that month's cache).
export default function ExpenseFormScreen() {
  const params = useLocalSearchParams<{ edit?: string; month?: string }>();
  const month = params.month ?? currentMonth();
  const { data } = useMonthlyBudget(month);
  const { options } = useExpenseCategories();
  const { data: members = [] } = useMembers();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const existing = useMemo(() => data?.expenses.find((e) => e.id === params.edit), [data, params.edit]);

  // A new expense defaults to today, or to the 1st of the month being viewed when browsing another month.
  const [date, setDate] = useState<Date>(() => (month === currentMonth() ? new Date() : fromDayString(`${month}-01`)));
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("courses");
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setLabel(existing.label);
    setAmount(centsToInput(existing.amountCents));
    setCategory(existing.category);
    setMemberId(existing.memberId);
    setDate(fromDayString(existing.date));
  }, [existing]);

  const amountCents = parseAmount(amount);
  const isValid = label.trim().length > 0 && amountCents !== null;
  const saving = createExpense.isPending || updateExpense.isPending;

  async function onSave() {
    if (amountCents === null) return;
    const payload = { label: label.trim(), amountCents, category, memberId, date: toDayString(date) };
    // Computed before saving, from the month's totals as they were.
    const crossed = capCrossed(data, payload, existing);
    try {
      const res = existing ? await updateExpense.mutateAsync({ id: existing.id, data: payload }) : await createExpense.mutateAsync(payload);
      const saved = existing ? "Dépense modifiée." : "Dépense ajoutée.";
      // Premium: the server raises an alert at 80 % and 100 % of the cap.
      // Everyone else: the local check above, when the cap is crossed.
      const alert = res.alert;
      const warning =
        alert?.level === 100
          ? `Plafond « ${alert.categoryName} » atteint : ${formatEuros(alert.totalCents)} sur ${formatEuros(alert.limitCents)}.`
          : !alert && crossed
            ? `Plafond « ${categoryLabel(options, category)} » dépassé : ${formatEuros(crossed.totalCents)} / ${formatEuros(crossed.limitCents)}.`
            : null;
      if (warning) useToastStore.getState().show(`${saved} ${warning}`, "warning");
      else if (alert)
        useToastStore
          .getState()
          .show(`${saved} « ${alert.categoryName} » à ${Math.floor((alert.totalCents * 100) / alert.limitCents)} % du plafond : ${formatEuros(alert.totalCents)} sur ${formatEuros(alert.limitCents)}.`);
      else useToastStore.getState().show(saved);
      router.back();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer la dépense"));
    }
  }

  function onDelete() {
    if (!existing) return;
    const message = existing.recurringId
      ? `Retirer « ${existing.label} » de ce mois-ci ? Les autres mois ne changent pas.`
      : `Supprimer « ${existing.label} » ?`;
    Alert.alert("Supprimer la dépense", message, [
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
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {existing?.recurringId && (
          <Card>
            <Text size={13} tone="muted">
              Dépense récurrente : tes changements ne concernent que ce mois-ci. Pour tous les mois, passe par les réglages du Budget.
            </Text>
          </Card>
        )}

        <TextField label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="Ex. 42,50" keyboardType="decimal-pad" />

        <TextField label="Libellé" value={label} onChangeText={setLabel} placeholder="Ex. Supermarché" />

        <ChipPicker label="Catégorie" options={options} selected={category} onSelect={(v) => v && setCategory(v)} />

        {members.length > 0 && (
          <ChipPicker label="Pour qui ? (optionnel)" options={members.map((m) => ({ value: m.id, label: m.name }))} selected={memberId} onSelect={setMemberId} optional />
        )}

        <DateField label="Date" value={date} onChange={setDate} />

        {!isValid && (
          <Text tone="muted" size={13} center>
            {amount && amountCents === null ? "Montant invalide (ex. 42,50)." : "Un montant et un libellé sont nécessaires."}
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Ajouter la dépense"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
