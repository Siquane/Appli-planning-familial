import { useState } from "react";
import { Alert, View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { Card } from "./Card";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { useAddAdvance, useRemoveAdvance, useRepayAdvance } from "../hooks/useApi";
import { useToastStore } from "../state/toastStore";
import { formatEuros, parseAmount } from "../lib/money";
import { errorText } from "../lib/errors";
import { color, space } from "../theme/tokens";
import type { PocketMoneyAdvance } from "../api/types";

const toast = (m: string) => useToastStore.getState().show(m);

// Avances (dans l'argent de poche) : ce que l'enfant doit encore, et le bouton
// pour rembourser avec sa cagnotte quand il veut. Un parent peut aussi en
// ajouter ou en annuler.
export function AdvancesSection({ advances, owedCents, balanceCents, canEdit, childName }: { advances: PocketMoneyAdvance[]; owedCents: number; balanceCents: number; canEdit: boolean; childName: string | null }) {
  const repay = useRepayAdvance();
  const add = useAddAdvance();
  const remove = useRemoveAdvance();
  const [partFor, setPartFor] = useState<string | null>(null);
  const [part, setPart] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const open = advances.filter((a) => a.leftCents > 0);
  const you = canEdit ? (childName ?? "L'enfant") : "Tu";

  if (!open.length && !canEdit) return null;

  const doRepay = (a: PocketMoneyAdvance, cents?: number) =>
    repay.mutate(
      { id: a.id, amountCents: cents },
      {
        onSuccess: () => {
          setPartFor(null);
          setPart("");
          toast(cents && cents < a.leftCents ? `${formatEuros(cents)} remboursés.` : `« ${a.label} » est remboursé 🎉`);
        },
        onError: (e) => toast(errorText(e, "rembourser")),
      },
    );

  const confirmCancel = (a: PocketMoneyAdvance) =>
    Alert.alert("Annuler cette avance ?", `« ${a.label} » ne sera plus à rembourser. Ce qui a déjà été remboursé reste dans l'historique.`, [
      { text: "Garder", style: "cancel" },
      { text: "Annuler l'avance", style: "destructive", onPress: () => remove.mutate(a.id, { onError: (e) => toast(errorText(e, "annuler l'avance")) }) },
    ]);

  return (
    <View style={{ gap: space.sm }}>
      <Text weight="medium" size={15}>
        Avances {owedCents > 0 ? `· ${canEdit ? `${you} doit` : "tu dois"} ${formatEuros(owedCents)}` : ""}
      </Text>
      {open.map((a) => (
        <Card key={a.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="medium">
                {a.label}
              </Text>
              <Text size={12} tone="faint">
                Reste {formatEuros(a.leftCents)}
                {a.repaidCents > 0 ? ` sur ${formatEuros(a.amountCents)}` : ""}
              </Text>
            </View>
            {canEdit ? (
              <Pressable onPress={() => confirmCancel(a)} accessibilityLabel={`Annuler l'avance ${a.label}`} hitSlop={10}>
                <Text size={12} style={{ color: color.danger }}>
                  Annuler
                </Text>
              </Pressable>
            ) : null}
          </View>
          {partFor === a.id ? (
            <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
              <View style={{ flex: 1 }}>
                <TextField label="Combien ? (€)" value={part} onChangeText={setPart} keyboardType="decimal-pad" placeholder="Ex. 5" autoFocus />
              </View>
              <Button label="OK" variant="primary" disabled={!parseAmount(part)} loading={repay.isPending} needsNetwork onPress={() => doRepay(a, parseAmount(part) ?? undefined)} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button
                label={`Rembourser ${formatEuros(Math.min(a.leftCents, Math.max(0, balanceCents)) || a.leftCents)}`}
                variant="primary"
                style={{ flex: 1 }}
                disabled={balanceCents <= 0}
                loading={repay.isPending}
                needsNetwork
                onPress={() => doRepay(a, Math.min(a.leftCents, balanceCents))}
              />
              <Button label="Une partie" variant="ghost" disabled={balanceCents <= 0} onPress={() => setPartFor(a.id)} />
            </View>
          )}
        </Card>
      ))}
      {open.length > 0 && balanceCents <= 0 ? (
        <Text size={12} tone="faint">
          {canEdit ? `La cagnotte de ${you} est vide : il remboursera au prochain versement.` : "Ta cagnotte est vide : tu rembourseras au prochain versement."}
        </Text>
      ) : null}

      {canEdit ? (
        <Card style={{ gap: space.sm }}>
          <Text size={14} weight="medium">
            Avancer de l'argent
          </Text>
          <TextField label="Pour quoi ?" value={label} onChangeText={setLabel} placeholder="Ex. Jeu vidéo, sortie ciné" maxLength={80} />
          <TextField label="Montant (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="15" />
          <Button
            label="Ajouter l'avance"
            disabled={!parseAmount(amount) || !label.trim()}
            loading={add.isPending}
            needsNetwork
            onPress={() =>
              add.mutate(
                { amountCents: parseAmount(amount)!, label: label.trim() },
                {
                  onSuccess: () => {
                    setLabel("");
                    setAmount("");
                  },
                  onError: (e) => toast(errorText(e, "ajouter l'avance")),
                },
              )
            }
          />
          <Text size={11} tone="faint">
            {you} la rembourse quand il veut avec sa cagnotte, en une ou plusieurs fois.
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
