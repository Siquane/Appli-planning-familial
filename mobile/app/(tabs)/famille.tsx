import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Pressable } from "../../src/components/Touchable";
import { router, type Href } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Avatar } from "../../src/components/Avatar";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TabHeader } from "../../src/components/PageHeader";
import { ChevronRightIcon, DocumentIcon, GiftIcon, NoteIcon, ProfileIcon, StarIcon } from "../../src/components/icons";
import { useCreateMember, useMembers } from "../../src/hooks/useApi";
import { useIsChildAccount } from "../../src/state/authStore";
import type { Tint } from "../../src/api/types";
import { color, space, gutter } from "../../src/theme/tokens";

// Same rotation as onboarding, so new members keep alternating colors.
const TINTS: Tint[] = ["accent", "accent2", "neutral"];

const LINKS: { label: string; href: Href; Icon: (p: { size: number; color: string }) => React.JSX.Element }[] = [
  { label: "Notes", href: "/notes", Icon: NoteIcon },
  { label: "Étoiles et récompenses", href: "/stars", Icon: StarIcon },
  { label: "Documents", href: "/documents", Icon: DocumentIcon },
  { label: "Anniversaires", href: "/birthdays", Icon: GiftIcon },
  { label: "Comptes de la famille", href: "/family-access", Icon: ProfileIcon },
  { label: "Partager le planning", href: "/share", Icon: ProfileIcon },
];

// Ce qu'un compte enfant ne gère pas.
const ADULT_ONLY = ["Comptes de la famille", "Partager le planning"];

// « Famille » tab: who's in the family, and what belongs to everyone.
export default function FamilleTab() {
  const { data: members = [] } = useMembers();
  const createMember = useCreateMember();
  const isChild = useIsChildAccount();
  const [name, setName] = useState("");

  function addMember() {
    if (!name.trim()) return;
    createMember.mutate({ name: name.trim(), tint: TINTS[members.length % TINTS.length] });
    setName("");
  }

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Famille" />

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={13} tone="muted">
            Membres ({members.length})
          </Text>
          {!isChild && (
            <Text size={13} tone="faint">
              Touche un membre pour ses goûts, son régime et ses allergies, ou pour créer l'accès d'un enfant à Passerelle.
            </Text>
          )}
          <Card>
            {members.length === 0 && (
              <Text size={13} tone="muted">
                Aucun membre pour l'instant. Ajoute les personnes de ta famille pour leur attribuer des tâches.
              </Text>
            )}
            {members.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={isChild ? undefined : () => router.push(`/member/${m.id}`)}
                disabled={isChild}
                accessibilityLabel={`Fiche de ${m.name}`}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
              >
                <Avatar initials={m.initials} bg={m.tint === "neutral" ? color.neutral700 : color.accent800} fg={m.tint === "neutral" ? color.neutral100 : color.accent100} size={30} />
                <Text size={15} style={{ flex: 1 }}>
                  {m.name}
                </Text>
                {m.age != null && (
                  <Text size={13} tone="faint" mono>
                    {m.age} ans
                  </Text>
                )}
                {!isChild && <ChevronRightIcon size={14} color={color.neutral500} />}
              </Pressable>
            ))}
          </Card>
          {!isChild && <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <TextField value={name} onChangeText={setName} placeholder="Prénom" accessibilityLabel="Prénom du nouveau membre" onSubmitEditing={addMember} returnKeyType="done" />
            </View>
            <Button label="Ajouter" variant="secondary" onPress={addMember} disabled={!name.trim() || createMember.isPending} />
          </View>}
        </View>

        <View style={{ gap: space.sm }}>
          {LINKS.filter((l) => !isChild || !ADULT_ONLY.includes(l.label)).map(({ label, href, Icon }) => (
            <Pressable key={label} onPress={() => router.push(href)}>
              <Card row style={{ alignItems: "center" }}>
                <Icon size={16} color={color.neutral400} />
                <Text size={15} style={{ flex: 1, marginLeft: space.sm }}>
                  {label}
                </Text>
                <ChevronRightIcon size={14} color={color.neutral500} />
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
