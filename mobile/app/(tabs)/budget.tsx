import { RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TabHeader } from "../../src/components/PageHeader";
import { ChildSpaceBanner } from "../../src/components/ChildSpaceBanner";
import { PocketMoneyCard } from "../../src/components/PocketMoneyCard";
import { EmptyState } from "../../src/components/Playful";
import { ChevronRightIcon, PlusIcon } from "../../src/components/icons";
import { useSplitGroups } from "../../src/hooks/useApi";
import { formatEuros } from "../../src/lib/money";
import { mySide } from "../../src/lib/splits";
import { useAuthStore } from "../../src/state/authStore";
import { color, space } from "../../src/theme/tokens";
import type { SplitGroup } from "../../src/api/types";

// Onglet « Comptes » : les dépenses partagées avec d'autres (l'autre parent,
// des amis…), groupe par groupe, et qui doit combien à qui.
export default function ComptesScreen() {
  const { data: groups = [], isLoading, refetch, isRefetching } = useSplitGroups();
  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <Screen techGrid edges={["top"]} style={{ gap: space.lg }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.accent} />}>
      <TabHeader title="Comptes" />
      <ChildSpaceBanner />
      <PocketMoneyCard />

      <Button label="Nouveau groupe" variant="primary" block icon={<PlusIcon size={16} color={color.bg} />} onPress={() => router.push("/comptes/new")} />

      {!isLoading && groups.length === 0 ? (
        <EmptyState title="Partage tes dépenses" detail="Crée un groupe (les enfants avec l'autre parent, des vacances entre amis…), note qui a payé quoi : Passerelle calcule qui doit combien à qui." />
      ) : null}

      <View style={{ gap: space.sm }}>
        {active.map((g) => (
          <GroupCard key={g.id} group={g} />
        ))}
      </View>

      {archived.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted" weight="medium">
            Archivés
          </Text>
          {archived.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function GroupCard({ group: g }: { group: SplitGroup }) {
  const user = useAuthStore((s) => s.user);
  const side = mySide(g, user ? { name: user.name, memberId: user.childMemberId } : null);
  return (
    <Pressable onPress={() => router.push(`/comptes/${g.id}`)} accessibilityRole="button" accessibilityLabel={`${g.name}. ${side.text}`}>
      <Card row style={{ alignItems: "center", gap: space.md, opacity: g.archived ? 0.6 : 1 }}>
        <Text size={28}>{g.emoji}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={16} weight="semibold" numberOfLines={1}>
            {g.name}
          </Text>
          <Text size={12} tone="faint" numberOfLines={1}>
            {g.participants.map((p) => p.name).join(", ")} · {formatEuros(g.spentCents)} dépensés
          </Text>
          <Text size={13} weight="medium" style={{ color: side.tone === "plus" ? color.success : side.tone === "minus" ? color.danger : color.neutral400 }}>
            {side.text}
          </Text>
        </View>
        <ChevronRightIcon size={14} color={color.neutral500} />
      </Card>
    </Pressable>
  );
}
