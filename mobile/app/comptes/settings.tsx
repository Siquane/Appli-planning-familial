import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { CloseIcon } from "../../src/components/icons";
import { splitsApi } from "../../src/api/resources";
import { useSplitGroup, useSplitMutation } from "../../src/hooks/useApi";
import { GROUP_EMOJIS } from "../../src/lib/splits";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { color, gutter, radius, space } from "../../src/theme/tokens";
import { useQueryClient } from "@tanstack/react-query";

// Réglages d'un groupe : son nom et son icône, qui en fait partie, l'archiver
// (il reste consultable) ou le supprimer.
export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: g } = useSplitGroup(id);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [newPerson, setNewPerson] = useState("");

  useEffect(() => {
    if (g) {
      setName(g.name);
      setEmoji(g.emoji);
    }
  }, [g?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toast = (e: unknown, what: string) => useToastStore.getState().show(errorText(e, what));
  const update = useSplitMutation((data: { name?: string; emoji?: string; archived?: boolean }) => splitsApi.update(id!, data));
  const addPerson = useSplitMutation((n: string) => splitsApi.addParticipant(id!, { name: n }));
  const removePerson = useSplitMutation((pid: string) => splitsApi.removeParticipant(id!, pid));

  if (!g) {
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Réglages du groupe" onBack={() => router.back()} />
      </Screen>
    );
  }

  const changed = name.trim() !== g.name || emoji !== g.emoji;
  const saveName = () => update.mutate({ name: name.trim(), emoji }, { onSuccess: () => router.back(), onError: (e) => toast(e, "enregistrer le groupe") });

  const confirmDelete = () =>
    Alert.alert("Supprimer le groupe ?", "Toutes ses dépenses et ses photos seront effacées. Pour le garder sans le voir, archive-le plutôt.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          splitsApi
            .remove(g.id)
            .then(() => {
              void qc.invalidateQueries({ queryKey: ["splits"] });
              router.dismissTo("/(tabs)/budget");
            })
            .catch((e) => toast(e, "supprimer le groupe")),
      },
    ]);

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Réglages du groupe" onBack={() => router.back()} save={changed ? { onPress: saveName, disabled: !name.trim(), loading: update.isPending } : undefined} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        <TextField label="Nom du groupe" value={name} onChangeText={setName} maxLength={60} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {GROUP_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => setEmoji(e)}
              accessibilityRole="radio"
              accessibilityState={{ selected: emoji === e }}
              style={{ width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: emoji === e ? color.accent : color.divider }}
            >
              <Text size={24}>{e}</Text>
            </Pressable>
          ))}
        </View>
        {changed ? <Button label="Enregistrer" variant="primary" block onPress={saveName} disabled={!name.trim()} loading={update.isPending} /> : null}

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Qui partage ? ({g.participants.length})
          </Text>
          {g.participants.map((p) => (
            <Card key={p.id} row style={{ alignItems: "center" }}>
              <Text size={15} style={{ flex: 1 }}>
                {p.name}
                {p.memberId ? "  · famille" : ""}
              </Text>
              {!p.used && g.participants.length > 2 ? (
                <Pressable onPress={() => removePerson.mutate(p.id, { onError: (e) => toast(e, "retirer cette personne") })} accessibilityLabel={`Retirer ${p.name}`} hitSlop={10}>
                  <CloseIcon size={16} color={color.neutral400} />
                </Pressable>
              ) : null}
            </Card>
          ))}
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <TextField label="Ajouter quelqu'un" value={newPerson} onChangeText={setNewPerson} placeholder="Prénom" maxLength={40} />
            </View>
            <Button
              label="Ajouter"
              disabled={!newPerson.trim()}
              loading={addPerson.isPending}
              onPress={() => addPerson.mutate(newPerson.trim(), { onSuccess: () => setNewPerson(""), onError: (e) => toast(e, "ajouter cette personne") })}
            />
          </View>
          <Text size={12} tone="faint">
            On ne peut retirer que quelqu'un qui n'apparaît dans aucune dépense.
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Button
            label={g.archived ? "Désarchiver le groupe" : "Archiver le groupe"}
            onPress={() => update.mutate({ archived: !g.archived }, { onError: (e) => toast(e, "archiver le groupe") })}
            block
          />
          <Button label="Supprimer le groupe" variant="ghost" onPress={confirmDelete} block />
        </View>
      </KeyboardScrollView>
    </Screen>
  );
}
