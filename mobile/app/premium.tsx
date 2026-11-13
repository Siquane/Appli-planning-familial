import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { CheckIcon } from "../src/components/icons";
import { usePlan } from "../src/hooks/useApi";
import { PACKS, hasAnyPack, mealQuotaLabel } from "../src/lib/premium";
import { color, space } from "../src/theme/tokens";
import type { Plan } from "../src/api/types";

function frenchDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function isActive(plan: Plan | undefined, id: (typeof PACKS)[number]["id"]) {
  if (!plan) return false;
  if (id === "both") return plan.packs.budget.active && plan.packs.meals.active;
  return plan.packs[id].active;
}

// The Premium packs and the account's status. The store purchase isn't wired
// yet: packs are switched on by hand for now (server: npm run premium).
export default function PremiumScreen() {
  const { data: plan } = usePlan();
  const both = isActive(plan, "both");

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Premium" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <Text size={13} tone="muted">
          Planning, tâches, recettes, menu et budget restent gratuits. Choisis seulement ce qui te sert.
        </Text>

        {PACKS.map((pack) => {
          // With both packs active, highlight « Les 2 » only.
          const active = pack.id === "both" ? both : !both && isActive(plan, pack.id);
          const until = pack.id === "both" ? plan?.packs.budget.until : pack.id === "budget" ? plan?.packs.budget.until : plan?.packs.meals.until;
          return (
            <Card key={pack.id} style={{ gap: space[2], borderWidth: active ? 1 : 0, borderColor: color.accent400 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text heading weight="semibold" size={17} style={{ flex: 1 }}>
                  {pack.name}
                  {pack.id === "both" ? " ✨" : ""}
                </Text>
                <Text size={14} weight="medium">
                  {pack.month}
                  <Text size={12} tone="muted">
                    {" / mois"}
                  </Text>
                </Text>
              </View>
              <Text size={12} tone="faint">
                ou {pack.year} / an
              </Text>
              {pack.features.map((f) => (
                <View key={f} style={{ flexDirection: "row", gap: space[2] }}>
                  <View style={{ paddingTop: 2 }}>
                    <CheckIcon size={14} color={color.accent400} />
                  </View>
                  <Text size={13} style={{ flex: 1 }}>
                    {f}
                  </Text>
                </View>
              ))}
              {active && until ? (
                <Text size={12} tone="accent">
                  Actif jusqu'au {frenchDate(until)}
                </Text>
              ) : null}
            </Card>
          );
        })}

        {plan && (
          <View style={{ gap: space[2] }}>
            <Text size={13} tone="muted">
              Ce qu'il te reste en gratuit
            </Text>
            <Card style={{ gap: space[1] }}>
              {!plan.packs.meals.active && <Text size={13}>{mealQuotaLabel(plan.meals)}</Text>}
              {plan.documents.limit !== null ? (
                <Text size={13}>
                  {plan.documents.used} / {plan.documents.limit} documents
                </Text>
              ) : (
                <Text size={13}>Documents illimités</Text>
              )}
            </Card>
          </View>
        )}

        {!both && (
          <Card>
            <Text size={13} tone="muted" center>
              L'abonnement dans l'appli arrive bientôt.
            </Text>
          </Card>
        )}
        {hasAnyPack(plan) && !both && (
          <Text size={12} tone="faint" center>
            Le pack « Les 2 » revient moins cher que les deux séparés.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
