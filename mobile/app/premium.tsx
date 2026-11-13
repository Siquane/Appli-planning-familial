import { useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { PurchasesPackage } from "react-native-purchases";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { CheckIcon } from "../src/components/icons";
import { usePlan } from "../src/hooks/useApi";
import { PACKS, hasAnyPack, mealQuotaLabel, packUntilLabel } from "../src/lib/premium";
import { color, space } from "../src/theme/tokens";
import { Button } from "../src/components/Button";
import { useAuthStore } from "../src/state/authStore";
import { useToastStore } from "../src/state/toastStore";
import { MANAGE_SUBSCRIPTIONS_URL, buyPackage, isBillingAvailable, loadPackPrices, restorePurchases, type PackOffering, type PackPrices } from "../src/lib/billing";
import type { Plan } from "../src/api/types";

function frenchDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function isActive(plan: Plan | undefined, id: (typeof PACKS)[number]["id"]) {
  if (!plan) return false;
  if (id === "both") return plan.packs.budget.active && plan.packs.meals.active;
  return plan.packs[id].active;
}

// The Premium packs, bought through Google Play (RevenueCat). Without a
// RevenueCat key for the platform, the screen only presents the offer.
export default function PremiumScreen() {
  const { data: plan } = usePlan();
  const both = isActive(plan, "both");
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  const billing = isBillingAvailable();
  const [prices, setPrices] = useState<Partial<Record<PackOffering, PackPrices>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!billing || !userId) return;
    loadPackPrices(userId)
      .then(setPrices)
      .catch(() => useToastStore.getState().show("Impossible de charger les prix du Play Store pour le moment."));
  }, [billing, userId]);

  async function onBuy(key: string, offering: PackOffering, pkg: PurchasesPackage) {
    if (!userId) return;
    setBusy(key);
    try {
      const bought = await buyPackage(userId, pkg, offering, prices);
      if (bought) {
        await qc.invalidateQueries();
        useToastStore.getState().show("Merci ! Ton pack est actif. ✨");
      }
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "L'achat n'a pas abouti.");
    } finally {
      setBusy(null);
    }
  }

  async function onRestore() {
    if (!userId) return;
    setBusy("restore");
    try {
      await restorePurchases(userId);
      await qc.invalidateQueries();
      useToastStore.getState().show("Achats restaurés.");
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "La restauration a échoué.");
    } finally {
      setBusy(null);
    }
  }

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
                  {until.startsWith("2999") ? "Actif" : `Actif · prochaine échéance le ${frenchDate(until)}`}
                </Text>
              ) : null}
              {billing && !active && !(pack.id !== "both" && both) && (
                <View style={{ flexDirection: "row", gap: space[2], marginTop: space[1] }}>
                  {(["monthly", "annual"] as const).map((period) => {
                    const pkg = prices[pack.id]?.[period];
                    if (!pkg) return null;
                    const key = `${pack.id}-${period}`;
                    return (
                      <Button
                        key={period}
                        label={`${period === "monthly" ? "Mensuel" : "Annuel"} · ${pkg.product.priceString}`}
                        variant={pack.id === "both" && period === "annual" ? "primary" : "secondary"}
                        style={{ flex: 1 }}
                        onPress={() => onBuy(key, pack.id, pkg)}
                        loading={busy === key}
                        disabled={!!busy}
                      />
                    );
                  })}
                </View>
              )}
            </Card>
          );
        })}

        {plan && both ? (
          // Everything is unlocked: no free quota to show.
          <Card style={{ gap: space[1] }}>
            <Text size={14} weight="medium">
              Les 2 packs sont actifs {packUntilLabel(plan.packs.budget.until)}
            </Text>
            <Text size={13} tone="muted">
              Tout Passerelle est débloqué : menus, budget et documents sans limite.
            </Text>
          </Card>
        ) : plan ? (
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
                <Text size={13}>Documents illimités (grâce à ton pack)</Text>
              )}
            </Card>
          </View>
        ) : null}

        {billing ? (
          <View style={{ gap: space[2] }}>
            <Button label="Restaurer mes achats" variant="ghost" block onPress={onRestore} loading={busy === "restore"} disabled={!!busy} />
            {hasAnyPack(plan) && (
              <Button label="Gérer ou résilier mon abonnement" variant="ghost" block onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)} />
            )}
            <Text size={11} tone="faint" center>
              Abonnement renouvelé automatiquement, résiliable à tout moment depuis le Play Store.
            </Text>
          </View>
        ) : (
          !both && (
            <Card>
              <Text size={13} tone="muted" center>
                L'abonnement dans l'appli arrive bientôt.
              </Text>
            </Card>
          )
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
