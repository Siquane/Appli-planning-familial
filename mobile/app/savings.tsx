import { useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TextField } from "../src/components/TextField";
import { DateField } from "../src/components/DateField";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { TrashIcon } from "../src/components/icons";
import { useCreateSavingsGoal, useDeleteSavingsGoal, usePaySavingsGoal, usePlan, useSavingsGoals } from "../src/hooks/useApi";
import { formatEuros, monthsLeft, parseAmount, toDayString } from "../src/lib/money";
import { hasBudgetPack, showApiError } from "../src/lib/premium";
import { useToastStore } from "../src/state/toastStore";
import { color, radius, space } from "../src/theme/tokens";
import type { SavingsGoal } from "../src/api/types";

// Premium: savings goals. A payment is an « Épargne » expense linked to the
// goal, so it also shows in the month's budget.
export default function SavingsScreen() {
  const { data: plan } = usePlan();
  const { data: goals = [], isLoading } = useSavingsGoals();
  const create = useCreateSavingsGoal();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);

  const targetCents = parseAmount(target);
  const premium = hasBudgetPack(plan);

  async function onCreate() {
    if (!premium) return router.push("/premium");
    if (!name.trim() || targetCents === null) return;
    try {
      await create.mutateAsync({ name: name.trim(), targetCents, deadline: deadline ? toDayString(deadline) : null });
      setName("");
      setTarget("");
      setDeadline(null);
      useToastStore.getState().show("Objectif créé.");
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Objectifs d'épargne" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        {!premium && (
          <Pressable onPress={() => router.push("/premium")}>
            <Card>
              <Text size={13} weight="medium">
                Pack Budget ✨
              </Text>
              <Text size={12} tone="muted">
                Mets de côté pour les vacances, Noël ou la voiture, et regarde la jauge se remplir. Voir Premium ›
              </Text>
            </Card>
          </Pressable>
        )}

        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} premium={premium} />
        ))}

        {!isLoading && goals.length === 0 && premium && (
          <Text size={13} tone="muted" center>
            Aucun objectif pour l'instant.
          </Text>
        )}

        <View style={{ gap: space[3] }}>
          <Text size={13} tone="muted" weight="medium">
            Nouvel objectif
          </Text>
          <TextField label="Nom" value={name} onChangeText={setName} placeholder="Ex. Vacances d'été, Noël…" />
          <TextField label="Montant à atteindre (€)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="1 200" />
          <DateField label="Pour quand ? (optionnel)" value={deadline} onChange={setDeadline} />
          <Button
            label={premium ? "Créer l'objectif" : "Créer l'objectif · Pack Budget"}
            variant="primary"
            block
            onPress={onCreate}
            loading={create.isPending}
            disabled={premium && (!name.trim() || targetCents === null)}
          />
        </View>
      </KeyboardScrollView>
    </Screen>
  );
}

function GoalCard({ goal, premium }: { goal: SavingsGoal; premium: boolean }) {
  const pay = usePaySavingsGoal();
  const remove = useDeleteSavingsGoal();
  const [amount, setAmount] = useState("");
  const amountCents = parseAmount(amount);
  const ratio = Math.min(1, goal.savedCents / goal.targetCents);
  const left = Math.max(0, goal.targetCents - goal.savedCents);
  const months = monthsLeft(goal.deadline);
  const reached = left === 0;

  async function onPay() {
    if (amountCents === null) return;
    try {
      await pay.mutateAsync({ id: goal.id, amountCents });
      setAmount("");
      useToastStore.getState().show(goal.savedCents + amountCents >= goal.targetCents ? `🎉 Objectif « ${goal.name} » atteint !` : "Versement ajouté.");
    } catch (e) {
      showApiError(e);
    }
  }

  function onDelete() {
    Alert.alert("Supprimer l'objectif", `Supprimer « ${goal.name} » ? Les versements restent dans le budget, en Épargne.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => remove.mutate(goal.id) },
    ]);
  }

  return (
    <Card style={{ gap: space[2] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text size={15} weight="medium" style={{ flex: 1 }}>
          {goal.name}
        </Text>
        <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`Supprimer ${goal.name}`}>
          <TrashIcon size={15} color={color.neutral500} />
        </Pressable>
      </View>
      <Text size={13}>
        <Text size={13} weight="semibold">
          {formatEuros(goal.savedCents)}
        </Text>
        <Text size={13} tone="muted">{` sur ${formatEuros(goal.targetCents)}`}</Text>
      </Text>
      <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: color.neutral800, overflow: "hidden" }}>
        <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: color.accent400, width: `${ratio * 100}%` }} />
      </View>
      <Text size={12} tone={reached ? "accent" : "faint"}>
        {reached
          ? "🎉 Objectif atteint !"
          : months
            ? `Encore ${formatEuros(left)} · environ ${formatEuros(Math.ceil(left / months))} par mois`
            : `Encore ${formatEuros(left)}`}
      </Text>
      {premium && !reached && (
        <View style={{ flexDirection: "row", gap: space[2], alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Montant versé (€)" />
          </View>
          <Button label="Verser" variant="secondary" onPress={onPay} loading={pay.isPending} disabled={amountCents === null} />
        </View>
      )}
    </Card>
  );
}
