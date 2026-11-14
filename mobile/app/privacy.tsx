import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { TopBar } from "../src/components/TopBar";
import { Accordion } from "../src/components/Accordion";
import { useFoodConsent, useSetFoodConsent } from "../src/hooks/useApi";
import { deleteAccount } from "../src/lib/account";
import { ApiError } from "../src/api/client";
import { useToastStore } from "../src/state/toastStore";
import { space, gutter } from "../src/theme/tokens";
import { errorText } from "../src/lib/errors";

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text size={13} weight="medium">
        {title}
      </Text>
      <Text size={13} tone="muted">
        {children}
      </Text>
    </View>
  );
}

/** Public privacy policy page (also the URL given to the Play Store). */
export const PRIVACY_POLICY_URL = "https://claude.ai/artifact/6q5yK3yYE2SmCnZAMqDxmv";

// What Passerelle stores, where it goes, and the user's rights (RGPD): withdraw
// the health-data consent, delete the account.
export default function PrivacyScreen() {
  const { data: consentedAt } = useFoodConsent();
  const setConsent = useSetFoodConsent();
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  function onWithdraw() {
    Alert.alert(
      "Retirer ton accord ?",
      "Les régimes, allergies et aliments à limiter de tous les membres seront effacés. Les autres préférences (plats aimés, cantine…) sont gardées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Retirer et effacer",
          style: "destructive",
          onPress: () =>
            setConsent.mutate(false, {
              onSuccess: () => useToastStore.getState().show("Accord retiré, données de santé effacées."),
              onError: (e) => useToastStore.getState().show(errorText(e, "mettre à jour ce réglage")),
            }),
        },
      ],
    );
  }

  function onDelete() {
    Alert.alert(
      "Supprimer ton compte ?",
      "Tout sera effacé définitivement : membres, tâches, recettes, menus, budget, documents. Un abonnement Play Store éventuel est à annuler dans le Play Store.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount(password);
              router.replace("/");
            } catch (e) {
              if (e instanceof ApiError && e.code === "family_has_members") {
                // Other accounts use this family: say so and ask again before deleting for everyone.
                setDeleting(false);
                Alert.alert("D'autres comptes utilisent cette famille", e.message, [
                  { text: "Annuler", style: "cancel" },
                  {
                    text: "Tout supprimer",
                    style: "destructive",
                    onPress: async () => {
                      setDeleting(true);
                      try {
                        await deleteAccount(password, true);
                        router.replace("/");
                      } catch (err) {
                        useToastStore.getState().show(errorText(err, "supprimer le compte"));
                      } finally {
                        setDeleting(false);
                      }
                    },
                  },
                ]);
                return;
              }
              useToastStore.getState().show(errorText(e, "supprimer le compte"));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Confidentialité" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Accordion title="Ce que Passerelle enregistre" defaultOpen>
          <Section title="Tes données">
            Compte (e-mail, prénom, mot de passe chiffré), membres de la famille, tâches, recettes, menus, liste de courses, budget, documents, et les préférences repas de chaque membre.
          </Section>
          <Section title="Relevés bancaires (Budget+)">
            Le PDF est lu par notre serveur le temps de l'analyse, puis oublié : jamais enregistré, jamais envoyé à Claude ni à une autre entreprise. Seules les dépenses que tu coches sont gardées, avec les catégories que tu corriges pour les retenir au prochain import.
          </Section>
          <Section title="Où">
            Base de données en Europe (Neon, Francfort), serveur Render, fichiers chez Cloudflare R2 (privés, liens temporaires). Les e-mails de mot de passe oublié passent par Brevo.
          </Section>
          <Section title="Erreurs de l'appli">
            En cas de plantage, un rapport technique est envoyé à Sentry (serveurs en Europe), sans données personnelles.
          </Section>
        </Accordion>

        <Accordion title="Partage en famille">
          <Section title="Qui voit quoi">
            Avec un code famille, d'autres personnes (dès 15 ans) ont leur propre compte autour de la même famille. Profil Complet : tout est partagé. Profil Planning : le planning, les repas, les courses et les recettes sont partagés ; le budget et les documents restent personnels.
          </Section>
          <Section title="Santé et régimes">
            Les régimes et allergies enregistrés avec ton accord sont visibles de tous les comptes de la famille.
          </Section>
          <Section title="Partir ou retirer">
            Le créateur peut retirer un compte et chacun peut quitter la famille : le compte reste, sans les données partagées. Si le créateur supprime son compte, les données partagées sont effacées après un avertissement.
          </Section>
        </Accordion>

        <Accordion title="Ce qui est envoyé à Claude">
          <Section title="Seulement quand tu génères des menus">
            Tes réponses aux questions (régimes, temps de cuisine, envies…), les titres de tes recettes, les repas déjà prévus de la semaine, et les préférences de chaque membre.
          </Section>
          <Section title="Sans prénom">
            Les membres sont désignés « Adulte 1 », « Enfant 2 »… avec leur âge. Aucun prénom, e-mail ni genre n'est transmis.
          </Section>
          <Section title="Chez Anthropic">
            Claude est fourni par Anthropic (États-Unis). Les données envoyées par l'API ne servent pas à entraîner ses modèles et ne sont gardées que peu de temps.
          </Section>
        </Accordion>

        <Card style={{ gap: space.sm }}>
          <Text size={15} weight="medium">
            Données de santé et régimes
          </Text>
          <Text size={13} tone="muted">
            {consentedAt
              ? `Accord donné le ${new Date(consentedAt).toLocaleDateString("fr-FR")}. Les régimes, allergies et aliments à limiter des membres peuvent être enregistrés.`
              : "Pas d'accord donné : les régimes, allergies et aliments à limiter ne sont pas enregistrés. Tu peux le donner depuis la fiche d'un membre (onglet Famille, rubrique Repas)."}
          </Text>
          {consentedAt ? <Button label="Retirer mon accord et effacer ces données" variant="secondary" block loading={setConsent.isPending} onPress={onWithdraw} /> : null}
        </Card>

        <Button label="Lire la politique de confidentialité complète" variant="ghost" block onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})} />

        <Card style={{ gap: space.sm }}>
          <Text size={15} weight="medium">
            Tes droits
          </Text>
          <Text size={13} tone="muted">
            Tu peux modifier ou supprimer chaque information depuis l'appli (fiche d'un membre, recettes, documents…), ou supprimer tout ton compte ci-dessous.
          </Text>
        </Card>

        <Accordion title="Supprimer mon compte">
          <Text size={13} tone="muted">
            Efface définitivement toutes les données de la famille. Saisis ton mot de passe pour confirmer.
          </Text>
          <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <Button label="Supprimer mon compte" variant="secondary" block loading={deleting} disabled={!password} onPress={onDelete} />
        </Accordion>
      </KeyboardScrollView>
    </Screen>
  );
}
