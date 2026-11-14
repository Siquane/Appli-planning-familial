import { useState } from "react";
import { Alert, Share as RNShare, View } from "react-native";
import { router } from "expo-router";
import { Pressable, hitSlopFor } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { TopBar } from "../src/components/TopBar";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { Chip } from "../src/components/Chip";
import { Avatar } from "../src/components/Avatar";
import { CloseIcon, CopyIcon } from "../src/components/icons";
import { useCreateFamilyInvite, useFamily, useRemoveFamilyAccount, useRevokeFamilyInvite } from "../src/hooks/useApi";
import { leaveFamily } from "../src/lib/account";
import { ROLE_EXPLANATION, ROLE_LABEL, inviteValidity, joinedSummary, shareMessage } from "../src/lib/family";
import { errorText } from "../src/lib/errors";
import { useAuthStore } from "../src/state/authStore";
import { useToastStore } from "../src/state/toastStore";
import { color, space, gutter } from "../src/theme/tokens";

const toast = (m: string) => useToastStore.getState().show(m);

// Who is in the family, and the code to add someone (15 years old or more).
export default function FamilyAccessScreen() {
  const { data: family, isLoading } = useFamily();
  const create = useCreateFamilyInvite();
  const revoke = useRevokeFamilyInvite();
  const remove = useRemoveFamilyAccount();
  const user = useAuthStore((s) => s.user);
  const [role, setRole] = useState<"full" | "planning">("planning");

  const isOwner = family?.role === "owner";
  const ownerName = family?.accounts.find((a) => a.role === "owner")?.name ?? null;
  const full = !!family && family.accounts.length >= family.maxAccounts;

  async function onCreate() {
    try {
      await create.mutateAsync(role);
    } catch (e) {
      toast(errorText(e, "créer le code"));
    }
  }

  async function onShare() {
    if (!family?.invite) return;
    try {
      await RNShare.share({ message: shareMessage(family.invite.code, user?.name?.trim() || "Quelqu'un", family.invite.expiresAt) });
    } catch {
      // The share sheet was dismissed: nothing to do.
    }
  }

  function onRemove(id: string, name: string) {
    Alert.alert(`Retirer ${name} ?`, `${name} garde son compte, mais ne voit plus le planning de la famille.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Retirer",
        style: "destructive",
        onPress: () => remove.mutate(id, { onError: (e) => toast(errorText(e, "retirer ce compte")) }),
      },
    ]);
  }

  function onLeave() {
    Alert.alert("Quitter la famille ?", "Tu ne verras plus son planning. Ton compte reste, avec ton budget et tes documents personnels.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter",
        style: "destructive",
        onPress: async () => {
          try {
            await leaveFamily();
            toast("Tu as quitté la famille.");
            router.back();
          } catch (e) {
            toast(errorText(e, "quitter la famille"));
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Comptes de la famille" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        {isLoading && <Text tone="muted" size={13}>Chargement…</Text>}

        {family && !isOwner && (
          <Card style={{ gap: space.sm }}>
            <Text size={13}>{joinedSummary(family.role, ownerName)}</Text>
            <Button label="Quitter la famille" variant="secondary" block onPress={onLeave} />
          </Card>
        )}

        {family && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Comptes ({family.accounts.length} sur {family.maxAccounts})
            </Text>
            <Card>
              {family.accounts.map((a, i) => (
                <View
                  key={a.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
                >
                  <Avatar initials={a.initials} bg={color.accent800} fg={color.accent100} size={30} />
                  <View style={{ flex: 1 }}>
                    <Text size={15} numberOfLines={1}>
                      {a.name}
                      {a.isMe ? " (toi)" : ""}
                    </Text>
                    <Text size={13} tone="faint">
                      {ROLE_LABEL[a.role]}
                    </Text>
                  </View>
                  {isOwner && !a.isMe && (
                    <Pressable hitSlop={hitSlopFor(26)} onPress={() => onRemove(a.id, a.name)} accessibilityLabel={`Retirer ${a.name}`} style={{ padding: space.sm }}>
                      <CloseIcon size={14} color={color.neutral500} />
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          </View>
        )}

        {isOwner && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Inviter quelqu'un
            </Text>
            <Text size={13} tone="faint">
              À partir de 15 ans. Il crée son compte dans l'appli avec « J'ai un code famille ». Pour un plus jeune enfant, utilise plutôt le lien de partage du planning.
            </Text>

            {family?.invite && !family.invite.expired ? (
              <Card style={{ gap: space.sm, alignItems: "center" }}>
                <Text heading weight="semibold" size={28} selectable accessibilityLabel={`Code famille ${family.invite.code.split("").join(" ")}`}>
                  {family.invite.code}
                </Text>
                <Text size={13} tone="muted" center>
                  Profil {ROLE_LABEL[family.invite.role]} · {inviteValidity(family.invite.expiresAt)}
                </Text>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <Button label="Partager le code" icon={<CopyIcon size={16} color={color.text} />} variant="secondary" onPress={onShare} />
                  <Button label="Annuler le code" variant="ghost" onPress={() => revoke.mutate(undefined, { onError: (e) => toast(errorText(e, "annuler le code")) })} loading={revoke.isPending} />
                </View>
              </Card>
            ) : null}

            <Text size={13} tone="muted">
              Profil de la personne
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Chip label="Planning" size="sm" selected={role === "planning"} onPress={() => setRole("planning")} />
              <Chip label="Complet" size="sm" selected={role === "full"} onPress={() => setRole("full")} />
            </View>
            <Text size={13} tone="faint">
              {ROLE_EXPLANATION[role]}
            </Text>
            <Button
              label={family?.invite && !family.invite.expired ? "Remplacer par un nouveau code" : "Générer un code"}
              variant="primary"
              block
              loading={create.isPending}
              disabled={full}
              onPress={onCreate}
            />
            {full && (
              <Text size={13} tone="faint" center>
                La famille est complète ({family?.maxAccounts} comptes au plus).
              </Text>
            )}
            <Text size={11} tone="faint" center>
              Un code est valable 7 jours. L'abonnement Budget+ ou Repas+ est celui de la famille : personne ne paie deux fois.
            </Text>
          </View>
        )}
      </KeyboardScrollView>
    </Screen>
  );
}
