import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { NoteIcon, PlusIcon } from "../src/components/icons";
import { useNotes } from "../src/hooks/useApi";
import { filterNotes, noteHeading, notePreview, noteTint, sortNotes, type NoteFilter } from "../src/lib/notes";
import { goBack } from "../src/lib/navigation";
import { color, space, gutter } from "../src/theme/tokens";
import type { Note } from "../src/api/types";

const FILTERS: { key: NoteFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "family", label: "Famille" },
  { key: "mine", label: "Perso" },
];

// Notes de la famille et notes perso. Ouvert depuis l'onglet Famille ou le widget « Notes ».
export default function NotesScreen() {
  const { data: notes = [], isLoading } = useNotes();
  const [filter, setFilter] = useState<NoteFilter>("all");
  const shown = sortNotes(filterNotes(notes, filter));

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Notes" onBack={() => goBack("/famille")} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Button label="Nouvelle note" icon={<PlusIcon size={18} color={color.onGradient} />} variant="primary" block onPress={() => router.push("/note/new")} />

        <View style={{ flexDirection: "row", gap: space.xs }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} size="sm" fill />
          ))}
        </View>

        {!isLoading && shown.length === 0 && (
          <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.lg }}>
            <NoteIcon size={26} color={color.neutral600} />
            <Text size={13} tone="muted" center>
              {filter === "mine"
                ? "Aucune note perso. Elles ne sont visibles que par toi."
                : "Aucune note pour l'instant : code du portail, idées de cadeaux, numéros utiles…"}
            </Text>
          </Card>
        )}

        {shown.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function NoteCard({ note }: { note: Note }) {
  const tint = noteTint(note.color);
  const preview = notePreview(note);
  const who = note.shared ? (note.mine ? "Famille" : `Famille · ${note.authorName ?? "?"}`) : "Perso";
  return (
    <Pressable onPress={() => router.push(`/note/${note.id}`)} accessibilityRole="button" accessibilityLabel={`Note : ${noteHeading(note)}`}>
      <Card style={{ gap: space.xs, borderLeftWidth: tint ? 4 : 0, borderLeftColor: tint ?? undefined }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Text size={15} weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
            {note.pinned ? "📌 " : ""}
            {noteHeading(note)}
          </Text>
          <Text size={11} tone="faint">
            {who}
          </Text>
        </View>
        {preview ? (
          <Text size={13} tone="muted" numberOfLines={3}>
            {preview}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
