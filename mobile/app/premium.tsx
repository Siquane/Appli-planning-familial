import { useEffect, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { PurchasesPackage } from "react-native-purchases";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { TopBar } from "../src/components/TopBar";
import { CheckIcon, PiggyBankIcon, SparkleIcon, ToqueIcon } from "../src/components/icons";
import { usePlan, useStartBudgetTrial } from "../src/hooks/useApi";
import { PACKS, hasPaidPack, mealQuotaLabel, packUntilLabel, trialDaysLeft } from "../src/lib/premium";
import { requestNotificationPermission, syncTrialReminder } from "../src/lib/notifications";
import { color, space, gutter } from "../src/theme/tokens";
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
  // The trial isn't a purchase: Budget+ only counts as active once it's paid.
  const budgetPaid = plan.packs.budget.active && !plan.packs.budget.trial?.active;
  if (id === "both") return budgetPaid && plan.packs.meals.active;
  return id === "budget" ? budgetPaid : plan.packs[id].active;
}

// The Premium packs, bought through Google Play (RevenueCat). Without a
// RevenueCat key for the platform, the screen only presents the offer.
export default function PremiumScreen() {
  const { data: plan } = usePlan();
  const both = isActive(plan, "both");
  // The subscription belongs to the family: every account identifies with the family's id.
  const userId = useAuthStore((s) => s.user?.familyId ?? s.user?.id);
  const qc = useQueryClient();
  const startTrial = useStartBudgetTrial();
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
        useToastStore.getState().show("Merci ! Ton offre est active.", "sparkle");
      }
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "L'achat n'a pas abouti.");
    } finally {
      setBusy(null);
    }
  }

  async function onTrial() {
    try {
      const updated = await startTrial.mutateAsync();
      useToastStore.getState().show(`Essai de ${(updated.packs.budget.trial?.days ?? 28) / 7} semaines démarré. Bon essai !`, "sparkle");
      // The reminder 5 days before the end needs the notification permission.
      if (await requestNotificationPermission()) await syncTrialReminder(updated.packs.budget.trial?.endsAt);
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Impossible de démarrer l'essai. Réessaie.");
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
      <TopBar title="Passerelle+" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Text size={13} tone="muted">
          Planning, tâches, recettes, menu et budget restent gratuits. Choisis seulement ce qui te sert.
        </Text>

        {PACKS.map((pack) => {
          // With both packs active, highlight Passerelle+ only.
          const active = pack.id === "both" ? both : !both && isActive(plan, pack.id);
          const until = pack.id === "both" ? plan?.packs.budget.until : pack.id === "budget" ? plan?.packs.budget.until : plan?.packs.meals.until;
          const trial = pack.id === "budget" ? plan?.packs.budget.trial : undefined;
          return (
            <Card key={pack.id} style={{ gap: space.lg, borderWidth: active ? 1 : 0, borderColor: color.accent400 }}>
              {/* Left: icon(s) with the name under them. Right: the price, centred on that block. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.xl }}>
                <View style={{ flex: 1, alignItems: "flex-start" }}>
                  {/* Icon centred over the offer's name */}
                  <View style={{ alignItems: "center", gap: 2 }}>
                    {pack.id === "meals" ? (
                      <ToqueIcon size={56} color={color.pillar2} />
                    ) : pack.id === "budget" ? (
                      <PiggyBankIcon size={56} color={color.pillar3} />
                    ) : (
                      <View style={{ flexDirection: "row", gap: 2 }}>
                        <ToqueIcon size={48} color={color.pillar2} />
                        <PiggyBankIcon size={48} color={color.pillar3} />
                      </View>
                    )}
                    <Text heading weight="semibold" size={22}>
                      {pack.name}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text size={17} weight="medium">
                    {pack.month}
                    <Text size={15} tone="muted">
                      {" / mois"}
                    </Text>
                  </Text>
                  <Text size={15} tone="faint">
                    ou {pack.year} / an
                  </Text>
                </View>
              </View>
              {/* Features packed together, set apart from the header and the buttons. */}
              <View style={{ gap: 2 }}>
                {pack.features.map((f) => (
                  <View key={f} style={{ flexDirection: "row", gap: space.sm }}>
                    <View style={{ paddingTop: 2 }}>
                      <CheckIcon size={16} color={color.accent400} />
                    </View>
                    <Text size={15} style={{ flex: 1 }}>
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
              {trial?.active && trial.endsAt && !active ? (
                <Text size={13} tone="accent">
                  {`Essai gratuit jusqu'au ${frenchDate(trial.endsAt)} · il reste ${trialDaysLeft(trial.endsAt)} jour${trialDaysLeft(trial.endsAt) > 1 ? "s" : ""}`}
                </Text>
              ) : null}
              {trial?.available && !active ? (
                <Button label={`Essayer ${trial.days / 7} semaines gratuitement`} icon={<SparkleIcon size={18} color={color.bg} />} variant="primary" block loading={startTrial.isPending} onPress={onTrial} />
              ) : null}
              {active && until ? (
                <Text size={13} tone="accent">
                  {until.startsWith("2999") ? "Actif" : `Actif · prochaine échéance le ${frenchDate(until)}`}
                </Text>
              ) : null}
              {billing && !active && !(pack.id !== "both" && both) && (
                <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.xs }}>
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
          <Card style={{ gap: space.xs }}>
            <Text size={15} weight="medium">
              Passerelle+ est actif {packUntilLabel(plan.packs.budget.until)}
            </Text>
            <Text size={13} tone="muted">
              Tout Passerelle est débloqué : menus, budget et documents sans limite.
            </Text>
          </Card>
        ) : plan ? (
          <View style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Ce qu'il te reste en gratuit
            </Text>
            <Card style={{ gap: space.xs }}>
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
          <View style={{ gap: space.sm }}>
            <Button label="Restaurer mes achats" variant="ghost" block onPress={onRestore} loading={busy === "restore"} disabled={!!busy} />
            {hasPaidPack(plan) && (
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
        {hasPaidPack(plan) && !both && (
          <Text size={13} tone="faint" center>
            Passerelle+ revient moins cher que Repas+ et Budget+ séparés.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
