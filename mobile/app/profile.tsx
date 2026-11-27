import { useState } from "react";
import { Pressable } from "../src/components/Touchable";
import { Switch, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { BackHeader } from "../src/components/PageHeader";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { updateName } from "../src/lib/account";
import { Avatar } from "../src/components/Avatar";
import { CalendarIcon, ChevronRightIcon, ClockIcon, SparkleIcon } from "../src/components/icons";
import { workSummary } from "../src/lib/workHours";
import { useCalendarStatus, useConstraints, useDisconnectCalendar, usePlan } from "../src/hooks/useApi";
import { useAuthStore, useIsChildAccount } from "../src/state/authStore";
import { useToastStore } from "../src/state/toastStore";
import { connectAppleCalendar, startOAuthConnect } from "../src/lib/calendarConnect";
import { color, space } from "../src/theme/tokens";
import { useThemeStore } from "../src/state/themeStore";
import type { Scheme } from "../src/theme/tokens";


import { Platform } from "react-native";

const PROVIDERS: { key: "google" | "outlook" | "apple"; label: string }[] = [
  { key: "google", label: "Google Agenda" },
  { key: "outlook", label: "Outlook" },
  { key: "apple", label: Platform.OS === "ios" ? "Apple Calendar" : "Calendrier du téléphone" },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const themeScheme = useThemeStore((s) => s.scheme);
  const setThemeScheme = useThemeStore((s) => s.setScheme);

  // Changer de thème remonte tous les écrans (retour au Planning) : on revient ensuite ici.
  async function chooseTheme(next: Scheme) {
    if (next === themeScheme) return;
    await setThemeScheme(next);
    setTimeout(() => router.navigate("/profile"), 150);
  }

  const { data: status, refetch } = useCalendarStatus();
  const disconnect = useDisconnectCalendar();
  const plan = usePlan().data;
  const isChild = useIsChildAccount();
  const { data: constraints } = useConstraints();
  const packLabel = plan?.packs.budget.active && plan.packs.meals.active ? "Passerelle+" : plan?.packs.budget.active ? "Budget+" : plan?.packs.meals.active ? "Repas+" : "Découvrir Passerelle+";
  const [connecting, setConnecting] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const hasName = !!user?.name?.trim();

  function startEditName() {
    setNameDraft(user?.name?.trim() ?? "");
    setEditingName(true);
  }

  async function saveName() {
    if (!nameDraft.trim()) {
      useToastStore.getState().show("Indique au moins ton prénom.");
      return;
    }
    setSavingName(true);
    try {
      await updateName(nameDraft);
      setEditingName(false);
      useToastStore.getState().show("Nom enregistré.");
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Impossible d'enregistrer le nom.");
    } finally {
      setSavingName(false);
    }
  }

  // Google/Outlook need OAuth credentials on the server (see /calendar/status).
  // Without them, connecting would only open a raw error page in the browser.
  function isUnavailable(provider: "google" | "outlook" | "apple") {
    if (!status || provider === "apple") return false;
    return provider === "google" ? !status.googleConfigured : !status.microsoftConfigured;
  }

  async function onConnect(provider: "google" | "outlook" | "apple") {
    if (isUnavailable(provider)) {
      const name = provider === "google" ? "Google Agenda" : "Outlook";
      useToastStore.getState().show(`La synchronisation avec ${name} arrive bientôt.`);
      return;
    }
    setConnecting(provider);
    try {
      if (provider === "apple") {
        if (Platform.OS === "web") {
          useToastStore.getState().show("Le calendrier du téléphone n'est disponible que dans l'appli mobile.");
        } else {
          const res = await connectAppleCalendar();
          useToastStore.getState().show(res.ok ? "Calendrier du téléphone connecté." : (res.reason ?? "Impossible de connecter le calendrier du téléphone. Autorise l'accès au calendrier dans les réglages du téléphone, puis réessaie."));
          refetch();
        }
      } else {
        // The server's OAuth route segment is "microsoft"; the stored/display
        // provider key is "outlook" (see app/server/src/routes/calendar.ts).
        const res = await startOAuthConnect(provider === "outlook" ? "microsoft" : "google");
        if (res.ok) useToastStore.getState().show(`${provider === "google" ? "Google Agenda" : "Outlook"} connecté.`);
        refetch();
      }
    } finally {
      setConnecting(null);
    }
  }

  return (
    <Screen>
      <BackHeader title="Mon profil" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Avatar initials={user?.initials ?? ""} bg={color.accent800} fg={color.accent100} size={56} />
        <View style={{ flex: 1 }}>
          <Text heading weight="semibold" size={17} tone={hasName ? undefined : "muted"}>
            {hasName ? user!.name : "Prénom non renseigné"}
          </Text>
          <Text tone="muted" size={13}>
            {user?.email}
          </Text>
        </View>
        {!editingName && <Button label={hasName ? "Modifier" : "Ajouter"} variant="ghost" onPress={startEditName} />}
      </View>

      {editingName && (
        <Card style={{ gap: space.sm }}>
          <TextField
            label="Prénom et nom"
            value={nameDraft}
            onChangeText={setNameDraft}
            placeholder="Ex. Anaïs Martin"
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveName}
          />
          <View style={{ flexDirection: "row", gap: space.sm, justifyContent: "flex-end" }}>
            <Button label="Annuler" variant="ghost" onPress={() => setEditingName(false)} />
            <Button label="Enregistrer" variant="primary" loading={savingName} onPress={saveName} />
          </View>
        </Card>
      )}

      <Pressable
        onPress={() => chooseTheme(themeScheme === "light" ? "dark" : "light")}
        accessibilityRole="switch"
        accessibilityLabel="Thème clair"
        accessibilityState={{ checked: themeScheme === "light" }}
        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <Text weight="medium" size={13} tone="muted" style={{ flex: 1 }}>
          Apparence
        </Text>
        <Text size={13}>{themeScheme === "light" ? "Clair" : "Sombre"}</Text>
        <Switch
          value={themeScheme === "light"}
          onValueChange={(on) => chooseTheme(on ? "light" : "dark")}
          trackColor={{ false: color.neutral700, true: color.accent700 }}
          thumbColor={themeScheme === "light" ? color.accent300 : color.neutral300}
        />
      </Pressable>

      {/* Un compte enfant ne gère ni les agendas, ni les achats, ni les horaires de la famille. */}
      {!isChild && (
        <>
      <View style={{ gap: space.sm }}>
        <Text weight="medium" size={13} tone="muted">
          Synchronisation calendrier
        </Text>
        <Card>
          {PROVIDERS.map((p, i) => {
            const connection = status?.connections.find((c) => c.provider === p.key);
            const unavailable = !connection && isUnavailable(p.key);
            return (
              <View
                key={p.key}
                style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
              >
                <CalendarIcon size={16} color={color.neutral400} />
                <View style={{ flex: 1 }}>
                  <Text size={13}>{p.label}</Text>
                  {connection?.email && (
                    <Text size={12} tone="faint">
                      {connection.email}
                    </Text>
                  )}
                  {unavailable && (
                    <Text size={12} tone="faint">
                      Bientôt disponible
                    </Text>
                  )}
                </View>
                <Button
                  label={connection ? "Déconnecter" : unavailable ? "Bientôt" : "Connecter"}
                  variant={connection ? "secondary" : "ghost"}
                  loading={connecting === p.key}
                  onPress={() => (connection ? disconnect.mutate(p.key) : onConnect(p.key))}
                />
              </View>
            );
          })}
        </Card>
      </View>

      <Pressable onPress={() => router.push("/premium")}>
        <Card row style={{ alignItems: "center" }}>
          <SparkleIcon size={20} color={color.accent400} />
          <Text size={15} style={{ flex: 1, marginLeft: space.sm }}>
            {packLabel}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/schedule")}>
        <Card row style={{ alignItems: "center" }}>
          <ClockIcon size={16} color={color.neutral400} />
          <Text size={15} style={{ flex: 1, marginLeft: space.sm }}>
            Mes horaires
          </Text>
          <Text size={12} tone="faint" style={{ marginRight: space.sm }}>
            {workSummary(constraints?.work) ?? "Travail, sommeil, déjeuner"}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

        </>
      )}

      <Pressable onPress={() => router.push("/privacy")}>
        <Card row style={{ alignItems: "center" }}>
          <Text size={15} style={{ flex: 1 }}>
            Confidentialité et données
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/suggestions")}>
        <Card row style={{ alignItems: "center" }}>
          <Text size={15} style={{ flex: 1 }}>
            Suggestions de tâches selon l'âge
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <Button
        label="Se déconnecter"
        variant="secondary"
        block
        onPress={async () => {
          await signOut();
          router.replace("/");
        }}
      />
    </Screen>
  );
}
