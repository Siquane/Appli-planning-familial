import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { PlusIcon } from "../../src/components/icons";
import { splitsApi } from "../../src/api/resources";
import { useSplitGroup, useSplitMutation } from "../../src/hooks/useApi";
import { formatEuros, shortDay } from "../../src/lib/money";
import { findMe } from "../../src/lib/splits";
import { useAuthStore } from "../../src/state/authStore";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { color, gutter, space } from "../../src/theme/tokens";
import type { SplitTransfer } from "../../src/api/types";

// Un groupe : où en est chacun, les remboursements à faire (le moins de
// virements possible), et toutes les dépenses.
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: g, refetch, isRefetching } = useSplitGroup(id);
  const user = useAuthStore((s) => s.user);
  const settle = useSplitMutation((t: SplitTransfer) => splitsApi.settle(id!, t));
  const removeTransfer = useSplitMutation((eid: string) => splitsApi.removeExpense(id!, eid));

  if (!g) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Groupe" onBack={() => router.back()} />
      </Screen>
    );
  }

  const name = (pid: string) => g.participants.find((p) => p.id === pid)?.name ?? "?";
  const me = findMe(g.participants, user ? { name: user.name, memberId: user.childMemberId } : null);
  const myBalance = me ? (g.balances.find((b) => b.participantId === me.id)?.cents ?? 0) : null;
  const expenses = g.expenses ?? [];

  const confirmSettle = (t: SplitTransfer) =>
    Alert.alert("Marquer comme remboursé ?", `${name(t.fromId)} a remboursé ${formatEuros(t.amountCents)} à ${name(t.toId)}.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Remboursé",
        onPress: () => settle.mutate(t, { onError: (e) => useToastStore.getState().show(errorText(e, "enregistrer le remboursement")) }),
      },
    ]);

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={`${g.emoji} ${g.name}`} onBack={() => router.back()} onEdit={() => router.push(`/comptes/settings?id=${g.id}`)} />
      <ScrollView
        contentContainerStyle={{ padding: gutter, paddingBottom: 100, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.accent} />}
      >
        <Card style={{ gap: space.xs, alignItems: "center", paddingVertical: space.lg }}>
          <Text size={13} tone="muted">
            Dépensé ensemble
          </Text>
          <Text heading size={30} weight="semibold">
            {formatEuros(g.spentCents)}
          </Text>
          {myBalance !== null ? (
            <Text size={15} weight="medium" style={{ color: myBalance > 0 ? color.success : myBalance < 0 ? color.danger : color.neutral400 }}>
              {myBalance > 0 ? `On te doit ${formatEuros(myBalance)}` : myBalance < 0 ? `Tu dois ${formatEuros(-myBalance)}` : "Tu es à l'équilibre"}
            </Text>
          ) : null}
        </Card>

        <Button label="Ajouter une dépense" variant="primary" block icon={<PlusIcon size={16} color={color.bg} />} onPress={() => router.push(`/comptes/expense?group=${g.id}`)} />

        <View style={{ gap: space.sm }}>
          <Text weight="semibold" size={16}>
            Qui doit combien à qui
          </Text>
          {g.transfers.length === 0 ? (
            <Card>
              <Text tone="muted" size={14}>
                ✅ Tout le monde est à l'équilibre.
              </Text>
            </Card>
          ) : (
            g.transfers.map((t) => (
              <Card key={`${t.fromId}-${t.toId}`} row style={{ alignItems: "center", gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <Text size={15}>
                    <Text size={15} weight="semibold">
                      {name(t.fromId)}
                    </Text>
                    {" doit "}
                    <Text size={15} weight="semibold">
                      {formatEuros(t.amountCents)}
                    </Text>
                    {" à "}
                    <Text size={15} weight="semibold">
                      {name(t.toId)}
                    </Text>
                  </Text>
                </View>
                <Button label="Remboursé" variant="ghost" onPress={() => confirmSettle(t)} accessibilityLabel={`Marquer comme remboursé : ${name(t.fromId)} à ${name(t.toId)}`} />
              </Card>
            ))
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <Text weight="semibold" size={16}>
            Soldes
          </Text>
          <Card style={{ gap: space.sm }}>
            {g.balances.map((b) => (
              <View key={b.participantId} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text size={14}>{name(b.participantId)}</Text>
                <Text size={14} weight="medium" style={{ color: b.cents > 0 ? color.success : b.cents < 0 ? color.danger : color.neutral400 }}>
                  {b.cents > 0 ? "+" : ""}
                  {formatEuros(b.cents)}
                </Text>
              </View>
            ))}
          </Card>
        </View>

        <View style={{ gap: space.sm }}>
          <Text weight="semibold" size={16}>
            Dépenses ({g.expenseCount})
          </Text>
          {expenses.length === 0 ? (
            <Card>
              <Text tone="muted" size={14}>
                Aucune dépense pour l'instant. Touche « Ajouter une dépense » quand quelqu'un paie quelque chose pour le groupe.
              </Text>
            </Card>
          ) : null}
          {expenses.map((e) => {
            const myShare = me ? e.shares.find((s) => s.participantId === me.id)?.amountCents : undefined;
            const transfer = e.kind === "transfer";
            return (
              <Pressable
                key={e.id}
                onPress={() =>
                  transfer
                    ? Alert.alert("Annuler ce remboursement ?", `${e.title} : ${formatEuros(e.amountCents)}`, [
                        { text: "Garder", style: "cancel" },
                        { text: "Annuler le remboursement", style: "destructive", onPress: () => removeTransfer.mutate(e.id) },
                      ])
                    : router.push(`/comptes/expense?group=${g.id}&edit=${e.id}`)
                }
                accessibilityRole="button"
              >
                <Card row style={{ alignItems: "center", gap: space.sm, opacity: transfer ? 0.75 : 1 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text size={15} weight="medium" numberOfLines={1}>
                      {transfer ? `💸 ${e.title}` : e.title}
                      {e.photoUrl ? "  📎" : ""}
                    </Text>
                    <Text size={12} tone="faint" numberOfLines={1}>
                      {shortDay(e.date)} · {transfer ? "remboursement" : `payé par ${name(e.paidById)}`}
                      {!transfer && myShare !== undefined ? ` · ta part ${formatEuros(myShare)}` : ""}
                    </Text>
                  </View>
                  <Text size={15} weight="semibold">
                    {formatEuros(e.amountCents)}
                  </Text>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}
