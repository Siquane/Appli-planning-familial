import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { TextField } from "../src/components/TextField";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ChildSpaceBanner } from "../src/components/ChildSpaceBanner";
import { useAddPocketMoneyCredit, usePocketMoney, useRemovePocketMoneyCredit, useRemovePocketMoneyRule, useSetPocketMoneyRule } from "../src/hooks/useApi";
import { useIsChildAccount } from "../src/state/authStore";
import { useChildSpaceStore } from "../src/state/childSpaceStore";
import { useToastStore } from "../src/state/toastStore";
import { centsToInput, formatEuros, parseAmount } from "../src/lib/money";
import { nextLabel, ruleLabel } from "../src/lib/pocketMoney";
import { shortDate } from "../src/lib/appointments";
import { WEEKDAYS_SHORT } from "../src/lib/weekdays";
import { errorText } from "../src/lib/errors";
import { goBack, useBackFallback } from "../src/lib/navigation";
import { color, space, gutter } from "../src/theme/tokens";

const toast = (m: string) => useToastStore.getState().show(m);
const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];

// Argent de poche : l'enfant voit ses versements ; un parent (dans « Espace de
// Jules ») règle le versement automatique et ajoute des versements ponctuels.
export default function PocketMoneyScreen() {
  const isChild = useIsChildAccount();
  const childName = useChildSpaceStore((s) => s.name);
  const { data, isLoading } = usePocketMoney();
  const setRule = useSetPocketMoneyRule();
  const removeRule = useRemovePocketMoneyRule();
  const addCredit = useAddPocketMoneyCredit();
  const removeCredit = useRemovePocketMoneyCredit();
  useBackFallback("/(tabs)/budget");
  const canEdit = !isChild && !!childName;

  const [amount, setAmount] = useState("5");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [day, setDay] = useState(5);
  const loaded = useRef(false);
  useEffect(() => {
    if (!data?.rule || loaded.current) return;
    loaded.current = true;
    setAmount(centsToInput(data.rule.amountCents));
    setFrequency(data.rule.frequency);
    setDay(data.rule.day);
  }, [data]);

  const [creditAmount, setCreditAmount] = useState("");
  const [creditLabel, setCreditLabel] = useState("");

  const amountCents = parseAmount(amount);
  const creditCents = parseAmount(creditAmount);

  async function onSaveRule() {
    if (!amountCents) return;
    try {
      await setRule.mutateAsync({ amountCents, frequency, day });
      toast("Argent de poche réglé. Il commence dès le prochain versement.");
    } catch (e) {
      toast(errorText(e, "régler l'argent de poche"));
    }
  }

  function onStop() {
    Alert.alert("Arrêter l'argent de poche", "Les versements déjà reçus restent. Plus aucun versement automatique ne sera ajouté.", [
      { text: "Annuler", style: "cancel" },
      { text: "Arrêter", style: "destructive", onPress: () => removeRule.mutate(undefined, { onSuccess: () => toast("Argent de poche arrêté.") }) },
    ]);
  }

  async function onAddCredit() {
    if (!creditCents || !creditLabel.trim()) return;
    try {
      await addCredit.mutateAsync({ amountCents: creditCents, label: creditLabel.trim() });
      setCreditAmount("");
      setCreditLabel("");
      toast("Versement ajouté.");
    } catch (e) {
      toast(errorText(e, "ajouter le versement"));
    }
  }

  function onRemoveCredit(id: string, label: string) {
    Alert.alert("Retirer ce versement", `Retirer « ${label} » ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => removeCredit.mutate(id) },
    ]);
  }

  const title = isChild ? "Mon argent de poche" : `Argent de poche${childName ? ` de ${childName}` : ""}`;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={title} onBack={() => goBack("/(tabs)/budget")} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        <ChildSpaceBanner />

        {data && (
          <Card style={{ gap: space.xs, alignItems: "center", paddingVertical: space.lg }}>
            <Text size={13} tone="faint">
              Reste
            </Text>
            <Text heading size={32} weight="semibold" tone={data.balanceCents < 0 ? "danger" : "text"}>
              {formatEuros(data.balanceCents)}
            </Text>
            <Text size={13} tone="muted">
              Reçu {formatEuros(data.receivedCents)} · Dépensé {formatEuros(data.spentCents)}
            </Text>
            {data.rule && (
              <Text size={11} tone="faint" center>
                {ruleLabel(data.rule)} · {nextLabel(data.rule)}
              </Text>
            )}
          </Card>
        )}

        {canEdit && (
          <View style={{ gap: space.md }}>
            <Text weight="medium" size={15}>
              Versement automatique
            </Text>
            <TextField label="Montant (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="5" />
            <View style={{ flexDirection: "row", gap: space.xs }}>
              <Chip label="Chaque semaine" selected={frequency === "weekly"} onPress={() => { setFrequency("weekly"); setDay(5); }} size="sm" fill />
              <Chip label="Chaque mois" selected={frequency === "monthly"} onPress={() => { setFrequency("monthly"); setDay(1); }} size="sm" fill />
            </View>
            {frequency === "weekly" ? (
              <View style={{ flexDirection: "row", gap: space.xs }}>
                {WEEKDAYS_SHORT.map((label, i) => (
                  <Chip key={label} label={label} selected={day === i} onPress={() => setDay(i)} size="sm" fill />
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {MONTH_DAYS.map((d) => (
                  <Chip key={d} label={d === 1 ? "1er" : `le ${d}`} selected={day === d} onPress={() => setDay(d)} size="sm" />
                ))}
              </View>
            )}
            <Button label={data?.rule ? "Enregistrer" : "Mettre en place"} variant="primary" block disabled={!amountCents} loading={setRule.isPending} needsNetwork onPress={onSaveRule} />
            {data?.rule && <Button label="Arrêter l'argent de poche" variant="ghost" block onPress={onStop} needsNetwork />}
            <Text size={11} tone="faint">
              {childName ?? "L'enfant"} reçoit une notification sur son téléphone le jour du versement. Pense à lui donner l'argent en vrai !
            </Text>
          </View>
        )}

        {canEdit && (
          <View style={{ gap: space.md }}>
            <Text weight="medium" size={15}>
              Versement ponctuel
            </Text>
            <TextField label="Pour quoi ?" value={creditLabel} onChangeText={setCreditLabel} placeholder="Ex. Anniversaire de mamie" maxLength={80} />
            <TextField label="Montant (€)" value={creditAmount} onChangeText={setCreditAmount} keyboardType="decimal-pad" placeholder="10" />
            <Button label="Ajouter" variant="secondary" block disabled={!creditCents || !creditLabel.trim()} loading={addCredit.isPending} needsNetwork onPress={onAddCredit} />
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={15}>
            Versements reçus
          </Text>
          {!isLoading && (data?.credits.length ?? 0) === 0 && (
            <Text size={13} tone="muted">
              Aucun versement pour l'instant.
            </Text>
          )}
          {(data?.credits.length ?? 0) > 0 && (
            <Card>
              {data!.credits.map((c, i) => (
                <Pressable
                  key={c.id}
                  onLongPress={canEdit ? () => onRemoveCredit(c.id, c.label) : undefined}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
                >
                  <Text size={13} tone="faint" style={{ width: 56 }}>
                    {shortDate(c.day)}
                  </Text>
                  <Text size={13} style={{ flex: 1 }} numberOfLines={1}>
                    {c.label}
                  </Text>
                  <Text size={13} mono weight="medium">
                    +{formatEuros(c.amountCents)}
                  </Text>
                </Pressable>
              ))}
            </Card>
          )}
          {canEdit && (data?.credits.length ?? 0) > 0 && (
            <Text size={11} tone="faint">
              Appui long sur un versement pour le retirer.
            </Text>
          )}
        </View>
      </KeyboardScrollView>
    </Screen>
  );
}
