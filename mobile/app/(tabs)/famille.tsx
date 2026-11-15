import { ScrollView, View } from "react-native";
import { Pressable } from "../../src/components/Touchable";
import { router, type Href } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Avatar } from "../../src/components/Avatar";
import { TabHeader } from "../../src/components/PageHeader";
import { ChevronRightIcon, DocumentIcon, GiftIcon, ProfileIcon, StarIcon } from "../../src/components/icons";
import { useMembers } from "../../src/hooks/useApi";
import { color, space, gutter } from "../../src/theme/tokens";

const LINKS: { label: string; href: Href; Icon: (p: { size: number; color: string }) => React.JSX.Element }[] = [
  { label: "Étoiles et récompenses", href: "/stars", Icon: StarIcon },
  { label: "Documents", href: "/documents", Icon: DocumentIcon },
  { label: "Anniversaires", href: "/birthdays", Icon: GiftIcon },
  { label: "Comptes de la famille", href: "/family-access", Icon: ProfileIcon },
  { label: "Partager le planning", href: "/share", Icon: ProfileIcon },
];

// « Famille » tab: who's in the family, and what belongs to everyone.
export default function FamilleTab() {
  const { data: members = [] } = useMembers();

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Famille" />

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={13} tone="muted">
            Membres ({members.length})
          </Text>
          <Text size={13} tone="faint">
            Touche un membre pour ses goûts, son régime et ses allergies : les menus générés en tiennent compte.
          </Text>
          <Card>
            {members.length === 0 && (
              <Text size={13} tone="muted">
                Aucun membre pour l'instant.
              </Text>
            )}
            {members.map((m, i) => (
              <Pressable
                key={m.id}
                onPress={() => router.push(`/member/${m.id}`)}
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
                <ChevronRightIcon size={14} color={color.neutral500} />
              </Pressable>
            ))}
          </Card>
        </View>

        <View style={{ gap: space.sm }}>
          {LINKS.map(({ label, href, Icon }) => (
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
