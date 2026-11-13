import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { BackHeader } from "../src/components/PageHeader";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { updateName } from "../src/lib/account";
import { Avatar } from "../src/components/Avatar";
import { CalendarIcon, ChevronRightIcon, RecurringIcon } from "../src/components/icons";
import { useCalendarStatus, useDisconnectCalendar, usePlan } from "../src/hooks/useApi";
import { useAuthStore } from "../src/state/authStore";
import { useToastStore } from "../src/state/toastStore";
import { connectAppleCalendar, startOAuthConnect } from "../src/lib/calendarConnect";
import { color, space } from "../src/theme/tokens";
import { Platform, Pressable } from "react-native";

const PROVIDERS: { key: "google" | "outlook" | "apple"; label: string }[] = [
  { key: "google", label: "Google Calendar" },
  { key: "outlook", label: "Outlook" },
  { key: "apple", label: "Apple Calendar" },
];

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const { data: status, refetch } = useCalendarStatus();
  const disconnect = useDisconnectCalendar();
  const premium = usePlan().data?.premium ?? false;
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
      const name = provider === "google" ? "Google Calendar" : "Outlook";
      useToastStore.getState().show(`La synchronisation ${name} n'est pas encore activée sur le serveur.`);
      return;
    }
    setConnecting(provider);
    try {
      if (provider === "apple") {
        if (Platform.OS === "web") {
          useToastStore.getState().show("Apple Calendar n'est disponible que sur iOS/Android.");
        } else {
          const res = await connectAppleCalendar();
          useToastStore.getState().show(res.ok ? "Apple Calendar connecté." : (res.reason ?? "Échec de connexion."));
          refetch();
        }
      } else {
        // The server's OAuth route segment is "microsoft"; the stored/display
        // provider key is "outlook" (see app/server/src/routes/calendar.ts).
        const res = await startOAuthConnect(provider === "outlook" ? "microsoft" : "google");
        if (res.ok) useToastStore.getState().show(`${provider === "google" ? "Google Calendar" : "Outlook"} connecté.`);
        refetch();
      }
    } finally {
      setConnecting(null);
    }
  }

  return (
    <Screen>
      <BackHeader title="Mon profil" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <Avatar initials={user?.initials ?? ""} bg={color.accent800} fg={color.accent100} size={56} />
        <View style={{ flex: 1 }}>
          <Text heading weight="semibold" size={18} tone={hasName ? undefined : "muted"}>
            {hasName ? user!.name : "Prénom non renseigné"}
          </Text>
          <Text tone="muted" size={13}>
            {user?.email}
          </Text>
        </View>
        {!editingName && <Button label={hasName ? "Modifier" : "Ajouter"} variant="ghost" onPress={startEditName} />}
      </View>

      {editingName && (
        <Card style={{ gap: space[3] }}>
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
          <View style={{ flexDirection: "row", gap: space[2], justifyContent: "flex-end" }}>
            <Button label="Annuler" variant="ghost" onPress={() => setEditingName(false)} />
            <Button label="Enregistrer" variant="primary" loading={savingName} onPress={saveName} />
          </View>
        </Card>
      )}

      <View style={{ gap: space[2] }}>
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
                style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
              >
                <CalendarIcon size={16} color={color.neutral400} />
                <View style={{ flex: 1 }}>
                  <Text size={13.5}>{p.label}</Text>
                  {connection?.email && (
                    <Text size={11} tone="faint">
                      {connection.email}
                    </Text>
                  )}
                  {unavailable && (
                    <Text size={11} tone="faint">
                      Pas encore activé sur le serveur
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
          <Text size={16}>✨</Text>
          <Text size={14} style={{ flex: 1, marginLeft: space[2] }}>
            {premium ? "Premium" : "Passer à Premium"}
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/recurring-tasks")}>
        <Card row style={{ alignItems: "center" }}>
          <RecurringIcon size={16} color={color.neutral400} />
          <Text size={14} style={{ flex: 1, marginLeft: space[2] }}>
            Tâches récurrentes
          </Text>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <Pressable onPress={() => router.push("/suggestions")}>
        <Card row style={{ alignItems: "center" }}>
          <Text size={14} style={{ flex: 1 }}>
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
