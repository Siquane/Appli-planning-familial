import { View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "./Touchable";
import { Card } from "./Card";
import { Text } from "./Text";
import { PiggyBankIcon, ChevronRightIcon } from "./icons";
import { usePocketMoney } from "../hooks/useApi";
import { useIsChildAccount } from "../state/authStore";
import { useChildSpaceStore } from "../state/childSpaceStore";
import { formatEuros } from "../lib/money";
import { nextLabel, ruleLabel } from "../lib/pocketMoney";
import { color, space } from "../theme/tokens";

// En haut du budget d'un enfant (ou de « Espace de Jules » pour un parent) :
// reçu, dépensé, ce qu'il reste. Un appui ouvre le détail (et les réglages pour un parent).
export function PocketMoneyCard() {
  const isChild = useIsChildAccount();
  const childName = useChildSpaceStore((s) => s.name);
  const { data } = usePocketMoney();
  if (!isChild && !childName) return null;
  if (!data) return null;

  const title = isChild ? "Mon argent de poche" : `Argent de poche de ${childName}`;
  return (
    <Pressable onPress={() => router.push("/pocket-money")} accessibilityRole="button" accessibilityLabel={title}>
      <Card style={{ gap: space.sm, borderWidth: 1, borderColor: color.pillar3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <PiggyBankIcon size={20} color={color.pillar3} />
          <Text weight="medium" size={15} style={{ flex: 1 }}>
            {title}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Figure label="Reçu" cents={data.receivedCents} />
          <Figure label="Dépensé" cents={data.spentCents} />
          <Figure label="Reste" cents={data.balanceCents} strong />
        </View>
        <Text size={11} tone="faint">
          {data.rule ? `${ruleLabel(data.rule)} · ${nextLabel(data.rule)}` : isChild ? "Pas encore d'argent de poche automatique." : "Touche pour régler un argent de poche automatique."}
        </Text>
      </Card>
    </Pressable>
  );
}

function Figure({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text size={11} tone="faint">
        {label}
      </Text>
      <Text size={strong ? 17 : 15} weight={strong ? "semibold" : "medium"} mono tone={strong && cents < 0 ? "danger" : "text"}>
        {formatEuros(cents)}
      </Text>
    </View>
  );
}
