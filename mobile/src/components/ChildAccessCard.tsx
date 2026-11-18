import { useState } from "react";
import { Alert, Share, View } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { Button } from "./Button";
import { useChildAccesses, useChildCode, useRemoveChildAccess } from "../hooks/useApi";
import { useAuthStore } from "../state/authStore";
import { useToastStore } from "../state/toastStore";
import { errorText } from "../lib/errors";
import { space } from "../theme/tokens";
import { router } from "expo-router";
import { enterChildSpace, exitChildSpace } from "../lib/childSpace";

// Fiche d'un enfant de 8 à 14 ans : un parent crée son accès à Passerelle
// (ce qui vaut accord parental) et lui donne un code à usage unique.
export function ChildAccessCard({ memberId }: { memberId: string }) {
  const role = useAuthStore((s) => s.user?.familyRole);
  const { data: children = [] } = useChildAccesses();
  const createCode = useChildCode();
  const remove = useRemoveChildAccess();
  const [code, setCode] = useState<{ value: string; expiresAt: string } | null>(null);

  const entry = children.find((c) => c.memberId === memberId);
  if (role === "child" || !entry) return null;
  const hasAccess = !!entry.accountId;

  async function onCreate() {
    try {
      const res = await createCode.mutateAsync(memberId);
      setCode({ value: res.code, expiresAt: res.expiresAt });
    } catch (e) {
      useToastStore.getState().show(errorText(e, "créer l'accès"));
    }
  }

  function onShare() {
    if (!code) return;
    Share.share({ message: `Ton code pour Passerelle : ${code.value}. Ouvre l'appli, touche « J'ai un code enfant » et saisis-le (valable 24 h).` }).catch(() => {});
  }

  function onRemove() {
    Alert.alert(`Supprimer l'accès de ${entry!.name}`, "Son téléphone sera déconnecté, et son budget et ses documents seront effacés. Le planning ne change pas.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          remove.mutate(memberId, {
            onSuccess: () => {
              exitChildSpace();
              setCode(null);
              useToastStore.getState().show(`Accès de ${entry!.name} supprimé.`);
            },
            onError: (e) => useToastStore.getState().show(errorText(e, "supprimer l'accès")),
          }),
      },
    ]);
  }

  return (
    <Card style={{ gap: space.sm }}>
      <Text weight="medium" size={15}>
        Accès à Passerelle
      </Text>
      {entry.problemText ? (
        <Text size={13} tone="muted">
          {entry.problemText}
        </Text>
      ) : (
        <>
          <Text size={13} tone="muted">
            {hasAccess
              ? `${entry.name} a son accès : le planning de la famille, ses tâches, ses documents, son budget et ses notes. Tu vois tout ce qu'il ou elle ajoute.`
              : `${entry.name} peut avoir Passerelle sur son téléphone, sans e-mail ni mot de passe : planning de la famille, ses documents, son budget et ses notes. En créant cet accès, tu donnes ton accord de parent.`}
          </Text>
          {code ? (
            <View style={{ gap: space.sm, alignItems: "center", paddingVertical: space.sm }}>
              <Text size={13} tone="faint">
                Code à saisir dans « J'ai un code enfant » (valable 24 h, une seule fois)
              </Text>
              <Text heading weight="semibold" size={28} selectable accessibilityLabel={`Code ${code.value.split("").join(" ")}`}>
                {code.value}
              </Text>
              <Button label="Envoyer le code" variant="secondary" block onPress={onShare} />
            </View>
          ) : (
            <Button
              label={hasAccess ? "Nouveau code (autre téléphone)" : `Créer l'accès de ${entry.name}`}
              variant={hasAccess ? "secondary" : "primary"}
              block
              loading={createCode.isPending}
              needsNetwork
              onPress={onCreate}
            />
          )}
          {hasAccess && (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button
                label="Son budget"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  enterChildSpace(memberId, entry.name);
                  router.navigate("/(tabs)/budget");
                }}
              />
              <Button
                label="Ses documents"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  enterChildSpace(memberId, entry.name);
                  router.push("/documents");
                }}
              />
            </View>
          )}
          {hasAccess && <Button label="Supprimer l'accès" variant="ghost" block onPress={onRemove} loading={remove.isPending} needsNetwork />}
        </>
      )}
    </Card>
  );
}
