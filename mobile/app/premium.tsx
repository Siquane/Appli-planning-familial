import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { CheckIcon } from "../src/components/icons";
import { usePlan } from "../src/hooks/useApi";
import { PREMIUM_PRICE_MONTH, PREMIUM_PRICE_YEAR, mealQuotaLabel } from "../src/lib/premium";
import { color, space } from "../src/theme/tokens";

const BENEFITS: { title: string; detail: string }[] = [
  { title: "Menus générés chaque semaine", detail: "Jusqu'à 12 semaines par mois, avec des « autre idée » pour ajuster." },
  { title: "Documents illimités", detail: "La version gratuite en garde 20." },
  { title: "Objectifs d'épargne", detail: "Vacances, Noël, voiture… avec une jauge qui se remplit." },
  { title: "Alertes de plafond", detail: "Prévenu à 80 % puis à 100 % d'un plafond du budget." },
  { title: "Bilan du budget", detail: "Graphiques sur 6 mois et comparaison avec le mois précédent." },
];

function frenchDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

// Premium offer and current status. The store purchase isn't wired yet:
// Premium is switched on by hand for now (server: npm run premium).
export default function PremiumScreen() {
  const { data: plan } = usePlan();

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Premium" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <Card style={{ alignItems: "center", paddingVertical: space[6], gap: space[1] }}>
          {plan?.premium ? (
            <>
              <Text heading weight="semibold" size={20}>
                Tu es Premium ✨
              </Text>
              {plan.premiumUntil && (
                <Text size={12} tone="muted">
                  Jusqu'au {frenchDate(plan.premiumUntil)}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text heading weight="semibold" size={20}>
                Passer à Premium
              </Text>
              <Text size={14}>
                {PREMIUM_PRICE_MONTH} / mois ou {PREMIUM_PRICE_YEAR} / an
              </Text>
              <Text size={12} tone="muted" center>
                Planning, tâches, recettes, menu et budget restent gratuits.
              </Text>
            </>
          )}
        </Card>

        <Card style={{ gap: space[3] }}>
          {BENEFITS.map((b) => (
            <View key={b.title} style={{ flexDirection: "row", gap: space[2] }}>
              <View style={{ paddingTop: 2 }}>
                <CheckIcon size={15} color={color.accent400} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={14} weight="medium">
                  {b.title}
                </Text>
                <Text size={12} tone="muted">
                  {b.detail}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {plan && !plan.premium && (
          <View style={{ gap: space[2] }}>
            <Text size={13} tone="muted">
              Ta version gratuite
            </Text>
            <Card style={{ gap: space[1] }}>
              <Text size={13}>{mealQuotaLabel(plan.meals)}</Text>
              {plan.documents.limit !== null && (
                <Text size={13}>
                  {plan.documents.used} / {plan.documents.limit} documents
                </Text>
              )}
            </Card>
          </View>
        )}

        {!plan?.premium && (
          <Card>
            <Text size={13} tone="muted" center>
              L'abonnement dans l'appli arrive bientôt.
            </Text>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}
