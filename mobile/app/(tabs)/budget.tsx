import { useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Segmented } from "../../src/components/Segmented";
import { MonthlyBudgetBody } from "../../src/screens/MonthlyBudgetBody";
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
import { useFamilyAdvances, useSplitGroups } from "../../src/hooks/useApi";
import { useIsChildAccount } from "../../src/state/authStore";
import { formatEuros } from "../../src/lib/money";
import { mySide } from "../../src/lib/splits";
import { useAuthStore } from "../../src/state/authStore";
import { color, space } from "../../src/theme/tokens";
import type { SplitGroup } from "../../src/api/types";

type Part = "budget" | "partages";

// Onglet « Budget » : « Mon budget » (dépenses du mois, plafonds, outils
// Budget+) et « Partagés » (dépenses partagées avec d'autres : l'autre parent,
// des amis…, groupe par groupe, et qui doit combien à qui).
export default function BudgetScreen() {
  const isChild = useIsChildAccount();
  // /budget?tab=partages ouvre directement les dépenses partagées (notifications des groupes).
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [part, setPart] = useState<Part>(tab === "partages" ? "partages" : "budget");
  useEffect(() => {
    if (tab === "partages" || tab === "budget") setPart(tab);
  }, [tab]);
  const { data: groups = [], isLoading, refetch, isRefetching } = useSplitGroups();
  const { data: kids = [] } = useFamilyAdvances();
  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <Screen techGrid edges={["top"]} style={{ gap: space.lg }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={color.accent} />}>
      <TabHeader title="Budget" />
      <ChildSpaceBanner />
      <PocketMoneyCard />

      {!isChild && (
        <Segmented
          tint={color.pillar3}
          value={part}
          onChange={setPart}
          items={[
            { key: "budget", label: "Mon budget" },
            { key: "partages", label: "Partagés" },
          ]}
        />
      )}

      {isChild || part === "budget" ? (
        <MonthlyBudgetBody onOpenShared={isChild ? undefined : () => setPart("partages")} />
      ) : (
        <>
      <Button label="Nouveau groupe" variant="primary" block icon={<PlusIcon size={16} color={color.bg} />} onPress={() => router.push("/comptes/new")} />

      {kids.length > 0 && <AdvancesCard kids={kids} />}

      {!isLoading && groups.length === 0 ? (
        <EmptyState title="Qui doit combien à qui ?" detail="Crée un groupe (les frais des enfants avec l'autre parent, des vacances entre amis…). Note qui a payé quoi, Passerelle fait les comptes." />
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
        </>
      )}
    </Screen>
  );
}

/** Ce que chaque enfant doit encore (argent avancé), et un bouton pour avancer. */
function AdvancesCard({ kids }: { kids: { memberId: string | null; name: string; owedCents: number }[] }) {
  const total = kids.reduce((n, k) => n + k.owedCents, 0);
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text size={16} weight="semibold" style={{ flex: 1 }}>
          🐷 Avances aux enfants
        </Text>
        <Button label="Avancer" variant="ghost" onPress={() => router.push("/comptes/advance")} />
      </View>
      {total === 0 ? (
        <Text size={13} tone="muted">
          Rien à rembourser. Quand tu paies quelque chose pour un enfant (un jeu, une sortie…), note-le ici : il le rembourse quand il veut avec son argent de poche.
        </Text>
      ) : (
        kids
          .filter((k) => k.owedCents > 0)
          .map((k) => (
            <View key={k.memberId ?? k.name} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size={14}>{k.name}</Text>
              <Text size={14} weight="medium" style={{ color: color.danger }}>
                doit {formatEuros(k.owedCents)}
              </Text>
            </View>
          ))
      )}
    </Card>
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
