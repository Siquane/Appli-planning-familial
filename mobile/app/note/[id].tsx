import { useEffect, useRef, useState } from "react";
import { Alert, Switch, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Pressable } from "../../src/components/Touchable";
import { Screen } from "../../src/components/Screen";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Chip } from "../../src/components/Chip";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../../src/hooks/useApi";
import { NOTE_COLORS, noteTint } from "../../src/lib/notes";
import { goBack, useBackFallback } from "../../src/lib/navigation";
import { errorText } from "../../src/lib/errors";
import { useToastStore } from "../../src/state/toastStore";
import { color, space, gutter } from "../../src/theme/tokens";
import type { NoteColor } from "../../src/api/types";

const toast = (m: string) => useToastStore.getState().show(m);

// Écrire ou modifier une note (`/note/new` pour en créer une, aussi depuis le widget).
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { data: notes = [], isLoading } = useNotes();
  const existing = isNew ? undefined : notes.find((n) => n.id === id);
  const create = useCreateNote();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  useBackFallback("/notes");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shared, setShared] = useState(true);
  const [noteColor, setNoteColor] = useState<NoteColor>("default");
  const [pinned, setPinned] = useState(false);

  // Rempli une seule fois : le rafraîchissement de la liste ne doit pas effacer la saisie.
  const loaded = useRef(false);
  useEffect(() => {
    if (!existing || loaded.current) return;
    loaded.current = true;
    setTitle(existing.title);
    setBody(existing.body);
    setShared(existing.shared);
    setNoteColor(existing.color);
    setPinned(existing.pinned);
  }, [existing]);

  if (!isNew && !existing && !isLoading) {
    return (
      <Screen scroll={false}>
        <TopBar title="Note" onBack={() => goBack("/notes")} />
        <Text tone="muted" style={{ padding: gutter }}>
          Cette note n'existe plus.
        </Text>
      </Screen>
    );
  }

  const empty = !title.trim() && !body.trim();
  // Une note de la famille écrite par quelqu'un d'autre ne peut pas devenir perso.
  const canMakePersonal = isNew || existing?.mine || !existing?.shared;
  const saving = create.isPending || update.isPending;

  async function onSave() {
    if (empty) return;
    const data = { title: title.trim(), body, shared, color: noteColor, pinned };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, data });
      else await create.mutateAsync(data);
      toast(existing ? "Note enregistrée." : "Note ajoutée.");
      goBack("/notes");
    } catch (e) {
      toast(errorText(e, "enregistrer la note"));
    }
  }

  function onDelete() {
    if (!existing) return;
    Alert.alert("Supprimer la note", existing.shared ? "Elle disparaîtra pour toute la famille." : "Supprimer cette note ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          remove.mutate(existing.id, {
            onSuccess: () => {
              toast("Note supprimée.");
              goBack("/notes");
            },
            onError: (e) => toast(errorText(e, "supprimer la note")),
          }),
      },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={isNew ? "Nouvelle note" : "Note"} onBack={() => goBack("/notes")} onDelete={existing ? onDelete : undefined} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TextField label="Titre (facultatif)" value={title} onChangeText={setTitle} placeholder="Ex. Code du portail" maxLength={120} />
        <TextField label="Note" value={body} onChangeText={setBody} multiline placeholder="Écris ici…" maxLength={10000} style={{ minHeight: 160, textAlignVertical: "top" }} />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Qui la voit ?
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            <Chip label="Famille" selected={shared} onPress={() => setShared(true)} size="sm" fill />
            <Chip label="Perso" selected={!shared} onPress={() => canMakePersonal && setShared(false)} size="sm" fill />
          </View>
          <Text size={11} tone="faint">
            {shared
              ? "Tous les comptes de la famille la voient et peuvent la modifier."
              : "Toi seul la vois."}
            {!canMakePersonal ? ` Écrite par ${existing?.authorName ?? "un autre compte"} : seule cette personne peut la rendre perso.` : ""}
          </Text>
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Couleur
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {NOTE_COLORS.map((c) => {
              const tint = noteTint(c.key);
              const selected = noteColor === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setNoteColor(c.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.label}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: tint ?? color.surface,
                    borderWidth: selected ? 3 : 1,
                    borderColor: selected ? color.text : color.divider,
                  }}
                />
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => setPinned((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: pinned }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <View style={{ flex: 1 }}>
            <Text size={15}>Épingler en haut</Text>
            <Text size={11} tone="faint">
              Les notes épinglées passent en premier, aussi sur le widget.
            </Text>
          </View>
          <Switch
            value={pinned}
            onValueChange={setPinned}
            trackColor={{ false: color.neutral700, true: color.accent700 }}
            thumbColor={pinned ? color.accent300 : color.neutral300}
          />
        </Pressable>

        <Button label={isNew ? "Ajouter la note" : "Enregistrer"} variant="primary" block onPress={onSave} disabled={empty} loading={saving} needsNetwork />
      </KeyboardScrollView>
    </Screen>
  );
}
