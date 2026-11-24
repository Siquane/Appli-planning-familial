import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Chip } from "../../src/components/Chip";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useAddFamilyAdvance, useFamilyAdvances } from "../../src/hooks/useApi";
import { useToastStore } from "../../src/state/toastStore";
import { formatEuros, parseAmount } from "../../src/lib/money";
import { errorText } from "../../src/lib/errors";
import { gutter, space } from "../../src/theme/tokens";

// Avancer de l'argent à un enfant (depuis l'onglet Comptes) : il le voit dans
// son argent de poche et le rembourse quand il veut avec sa cagnotte.
export default function NewAdvanceScreen() {
  const { data: kids = [] } = useFamilyAdvances();
  const withAccess = kids.filter((k) => !!k.memberId);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const add = useAddFamilyAdvance();
  const who = memberId ?? (withAccess.length === 1 ? withAccess[0].memberId : null);
  const cents = parseAmount(amount);
  const valid = !!who && !!cents && label.trim().length > 0;

  const save = () =>
    add.mutate(
      { memberId: who!, amountCents: cents!, label: label.trim() },
      {
        onSuccess: () => {
          useToastStore.getState().show(`Avance notée : ${formatEuros(cents!)}`);
          router.back();
        },
        onError: (e) => useToastStore.getState().show(errorText(e, "ajouter l'avance")),
      },
    );

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Avancer de l'argent" onBack={() => router.back()} save={{ onPress: save, disabled: !valid, loading: add.isPending }} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }}>
        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            À qui ?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {withAccess.map((k) => (
              <Chip key={k.memberId!} label={k.name} selected={who === k.memberId} onPress={() => setMemberId(k.memberId)} size="sm" />
            ))}
          </View>
          {withAccess.length === 0 ? (
            <Text size={13} tone="faint">
              Les avances sont pour les enfants qui ont leur accès à Passerelle (Famille → sa fiche → « Créer l'accès »).
            </Text>
          ) : null}
        </View>
        <TextField label="Pour quoi ?" value={label} onChangeText={setLabel} placeholder="Ex. Jeu vidéo, sortie ciné" maxLength={80} />
        <TextField label="Montant (€)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="15" />
        <Text size={12} tone="faint">
          L'enfant le voit dans son argent de poche et le rembourse quand il veut avec sa cagnotte, en une ou plusieurs fois.
        </Text>
        <Button label="Ajouter l'avance" variant="primary" block disabled={!valid} loading={add.isPending} onPress={save} />
      </KeyboardScrollView>
    </Screen>
  );
}
