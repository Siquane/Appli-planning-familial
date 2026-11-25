import { useState } from "react";
import { Pressable } from "../src/components/Touchable";
import { Alert, Share as RNShare, View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { TopBar } from "../src/components/TopBar";
import { TrashIcon } from "../src/components/icons";
import { useInvitePerson, useMemberShareLinks, useRemoveSharedPerson, useResetMemberShareLink, useShare } from "../src/hooks/useApi";
import type { MemberShareLink } from "../src/api/resources";
import { useToastStore } from "../src/state/toastStore";
import { API_URL } from "../src/api/client";
import { color, space, gutter } from "../src/theme/tokens";
import { de } from "../src/lib/elision";

// Page web de la semaine d'un membre (GET /share/m/:token, server/src/routes/share.ts).
const MEMBER_PAGE_URL = `${API_URL}/share/m`;

export default function ShareScreen() {
  const { data } = useShare();
  const { data: links = [], isLoading } = useMemberShareLinks();
  const reset = useResetMemberShareLink();
  const invite = useInvitePerson();
  const remove = useRemoveSharedPerson();
  const [name, setName] = useState("");

  async function onShareLink(l: MemberShareLink) {
    try {
      await RNShare.share({ message: `Le planning ${de(l.name)} sur Passerelle : ${MEMBER_PAGE_URL}/${l.token}` });
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  function onReset(l: MemberShareLink) {
    Alert.alert("Nouveau lien", `L'ancien lien du planning ${de(l.name)} ne fonctionnera plus. Il faudra renvoyer le nouveau.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Créer un nouveau lien",
        style: "destructive",
        onPress: () => reset.mutate(l.memberId, { onSuccess: () => useToastStore.getState().show(`Nouveau lien pour ${l.name}.`) }),
      },
    ]);
  }

  function onInvite() {
    if (!name.trim()) return;
    invite.mutate(
      { name: name.trim() },
      {
        onSuccess: () => {
          setName("");
          useToastStore.getState().show("Invitation envoyée.");
        },
      }
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Partager le planning" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Text tone="muted" size={13}>
          Un lien par membre : la personne qui l'ouvre voit la semaine de ce membre jour par jour (tâches et rendez-vous), dans son navigateur, sans compte. Pratique pour une nounou, un grand-parent ou un enfant.
        </Text>

        {!isLoading && links.length === 0 && (
          <Card>
            <Text size={13} tone="muted">
              Ajoute d'abord les membres de la famille (onglet Famille) et indique-les dans « Pour qui ? » sur leurs tâches.
            </Text>
          </Card>
        )}

        {links.map((l) => (
          <Card key={l.memberId} style={{ gap: space.sm }}>
            <Text size={15} weight="medium">
              Planning de {l.name}
            </Text>
            <Text size={12} tone="faint" mono numberOfLines={1}>
              {MEMBER_PAGE_URL}/{l.token}
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label="Partager le lien" variant="secondary" style={{ flex: 1 }} onPress={() => onShareLink(l)} />
              <Button label="Nouveau lien" variant="ghost" onPress={() => onReset(l)} needsNetwork />
            </View>
          </Card>
        ))}

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={13} tone="muted">
            Inviter quelqu'un
          </Text>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField value={name} onChangeText={setName} placeholder="Nom" onSubmitEditing={onInvite} returnKeyType="done" />
            </View>
            <Button label="Inviter" variant="secondary" onPress={onInvite} disabled={!name.trim()} loading={invite.isPending} />
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          {(data?.sharedWith ?? []).map((p) => (
            <Card key={p.id} row style={{ alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text size={15}>{p.name}</Text>
                <Text size={12} tone="faint">
                  {p.role}
                </Text>
              </View>
              <Pressable onPress={() => remove.mutate(p.id)} accessibilityLabel={`Retirer ${p.name}`}>
                <TrashIcon size={16} color={color.neutral500} />
              </Pressable>
            </Card>
          ))}
        </View>
      </KeyboardScrollView>
    </Screen>
  );
}
