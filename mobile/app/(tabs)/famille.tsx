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
import { BookIcon, ChevronRightIcon, DocumentIcon, GiftIcon, NoteIcon, ProfileIcon, StarIcon } from "../../src/components/icons";
import { useChildAccesses, useCreateMember, useMembers, useStars } from "../../src/hooks/useApi";
import { memberColor } from "../../src/lib/planningView";
import { memberAge, weekKey } from "../../src/lib/stars";
import { daysUntilBirthday, nextBirthdayOccurrence } from "../../src/lib/notifications";
import { useIsChildAccount } from "../../src/state/authStore";
import type { Tint } from "../../src/api/types";
import { color, space, gutter } from "../../src/theme/tokens";
import { de } from "../../src/lib/elision";

// Same rotation as onboarding, so new members keep alternating colors.
const TINTS: Tint[] = ["accent", "accent2", "neutral"];

const LINKS: { label: string; detail: string; href: Href; Icon: (p: { size: number; color: string }) => React.JSX.Element; tint: () => string }[] = [
  { label: "Étoiles", detail: "Pour les enfants", href: "/stars", Icon: StarIcon, tint: () => color.amber },
  { label: "Notes", detail: "Codes, listes, idées", href: "/notes", Icon: NoteIcon, tint: () => color.pillar4 },
  { label: "Documents", detail: "Carnets, assurances", href: "/documents", Icon: DocumentIcon, tint: () => color.pillar2 },
  { label: "Anniversaires", detail: "Et idées cadeaux", href: "/birthdays", Icon: GiftIcon, tint: () => color.pillar4 },
  { label: "Routines", detail: "Matin et soir", href: "/routines", Icon: BookIcon, tint: () => color.pillar3 },
  { label: "Accès à l'appli", detail: "Comptes des enfants", href: "/family-access", Icon: ProfileIcon, tint: () => color.pillar1 },
  { label: "Partager", detail: "Le planning, en lien", href: "/share", Icon: ProfileIcon, tint: () => color.pillar1 },
];

// Ce qu'un compte enfant ne gère pas.
const ADULT_ONLY = ["Accès à l'appli", "Partager", "Routines"];

const LONG_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

// « Famille » tab: who's in the family, and what belongs to everyone.
export default function FamilleTab() {
  const { data: members = [] } = useMembers();
  const createMember = useCreateMember();
  const isChild = useIsChildAccount();
  const [name, setName] = useState("");
  const { data: accesses = [] } = useChildAccesses();
  const { data: stars } = useStars(weekKey());
  const connected = new Set(accesses.filter((a) => a.accountId).map((a) => a.memberId));
  const balance = (id: string) => stars?.children.find((c) => c.memberId === id)?.balance;
  // Prochain anniversaire de la famille, pour la carte du haut.
  const next = members
    .filter((m) => m.birthday)
    .map((m) => ({ m, days: daysUntilBirthday(m.birthday!), date: nextBirthdayOccurrence(m.birthday!) }))
    .sort((a, b) => a.days - b.days)[0];
  const nextAge = next ? next.date.getFullYear() - Number(next.m.birthday!.slice(0, 4)) : null;
  const childCount = members.filter((m) => connected.has(m.id)).length;

  function addMember() {
    if (!name.trim()) return;
    createMember.mutate({ name: name.trim(), tint: TINTS[members.length % TINTS.length] });
    setName("");
  }

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Famille" />

        {next && (
          <Pressable onPress={() => router.push("/birthdays")} accessibilityRole="button">
            <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderWidth: 1, borderColor: color.pillar4 + "40" }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: color.pillar4 + "29", alignItems: "center", justifyContent: "center" }}>
                <GiftIcon size={26} color={color.pillar4} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={11} weight="semibold" style={{ color: color.pillar4, letterSpacing: 0.6 }}>
                  {next.days === 0 ? "AUJOURD'HUI" : next.days === 1 ? "DEMAIN" : `DANS ${next.days} JOURS`}
                </Text>
                <Text heading weight="semibold" size={16} numberOfLines={2}>
                  Anniversaire {de(next.m.name)}
                  {nextAge && nextAge > 0 ? ` · ${nextAge} ans` : ""}
                </Text>
                <Text size={12} tone="faint">
                  {LONG_DATE.format(next.date).replace(/^./, (c) => c.toUpperCase())}
                </Text>
              </View>
              <ChevronRightIcon size={14} color={color.neutral500} />
            </Card>
          </Pressable>
        )}

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text heading weight="semibold" size={16}>
              Membres
            </Text>
            <Text size={12} tone="faint">
              {members.length}
              {childCount > 0 ? ` · ${childCount} enfant${childCount > 1 ? "s" : ""} connecté${childCount > 1 ? "s" : ""}` : ""}
            </Text>
          </View>
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
                accessibilityLabel={`Fiche ${de(m.name)}`}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
              >
                <Avatar initials={m.name.trim().charAt(0).toUpperCase()} bg={memberColor(i) + "29"} fg={memberColor(i)} size={34} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text size={15} weight="medium">
                    {m.name}
                  </Text>
                  <Text size={12} tone="faint">
                    {[memberAge(m) != null ? `${memberAge(m)} ans` : null, memberAge(m) != null ? (memberAge(m)! < 18 ? "enfant" : "parent") : null].filter(Boolean).join(" · ")}
                    {connected.has(m.id) ? <Text size={12} style={{ color: color.success }}>{memberAge(m) != null ? " · " : ""}connecté à l'appli</Text> : null}
                  </Text>
                </View>
                {balance(m.id) != null && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }} accessibilityLabel={`${balance(m.id)} étoiles`}>
                    <StarIcon size={12} color={color.amber} />
                    <Text size={12} weight="semibold" style={{ color: color.amber }}>
                      {balance(m.id)}
                    </Text>
                  </View>
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

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {LINKS.filter((l) => !isChild || !ADULT_ONLY.includes(l.label)).map(({ label, detail, href, Icon, tint }) => (
            <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={`${label}, ${detail}`} style={{ flexBasis: "47%", flexGrow: 1 }}>
              <Card style={{ gap: 4, padding: space.md, minHeight: 92 }}>
                <Icon size={20} color={tint()} />
                <Text size={14} weight="semibold" style={{ marginTop: space.xs }} numberOfLines={1}>
                  {label}
                </Text>
                <Text size={11} tone="faint" numberOfLines={1}>
                  {detail}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
