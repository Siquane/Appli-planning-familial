import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { TextField } from "../../src/components/TextField";
import { Chip } from "../../src/components/Chip";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { FileSourceButtons } from "../../src/components/FileSourceButtons";
import { DocumentIcon } from "../../src/components/icons";
import { useDocuments, useMembers, useUpdateDocument, useUploadDocument } from "../../src/hooks/useApi";
import { DOCUMENT_CATEGORIES, formatSize, type PickedFile } from "../../src/lib/documentUpload";
import { useToastStore } from "../../src/state/toastStore";
import { showApiError } from "../../src/lib/premium";
import { color, space, gutter } from "../../src/theme/tokens";
import type { DocumentCategory } from "../../src/api/types";

// Add a document to the family library, or (with ?edit=<id>) rename and
// re-classify an existing one — the file itself can't be swapped.
export default function DocumentFormScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { data: documents = [] } = useDocuments();
  const { data: members = [] } = useMembers();
  const upload = useUploadDocument();
  const update = useUpdateDocument();
  const existing = useMemo(() => documents.find((d) => d.id === edit), [documents, edit]);

  const [file, setFile] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("autre");
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setCategory(existing.category);
    setMemberId(existing.memberId);
  }, [existing]);

  function onPicked(picked: PickedFile) {
    setFile(picked);
    if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ""));
  }

  const isValid = existing ? title.trim().length > 0 : !!file;
  const saving = upload.isPending || update.isPending;

  async function onSave() {
    try {
      if (existing) {
        await update.mutateAsync({ id: existing.id, data: { title: title.trim(), category, memberId } });
        useToastStore.getState().show("Document modifié.");
      } else if (file) {
        await upload.mutateAsync({ file, data: { title: title.trim() || undefined, category, memberId } });
        useToastStore.getState().show("Document ajouté.");
      }
      router.back();
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Modifier le document" : "Nouveau document"} onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        {!existing && (
          <View style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Fichier (photo ou PDF, 5 Mo max.)
            </Text>
            {file && (
              <Card row style={{ alignItems: "center" }}>
                <DocumentIcon size={16} color={color.accent400} />
                <Text size={13} numberOfLines={1} style={{ flex: 1, marginLeft: space.sm }}>
                  {file.name}
                </Text>
                {file.size ? (
                  <Text size={11} tone="faint">
                    {formatSize(file.size)}
                  </Text>
                ) : null}
              </Card>
            )}
            <FileSourceButtons onPicked={onPicked} disabled={saving} />
          </View>
        )}

        <TextField label="Nom" value={title} onChangeText={setTitle} placeholder="Ex. Ordonnance pédiatre" />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Catégorie
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {DOCUMENT_CATEGORIES.map((c) => (
              <Chip key={c.value} label={c.label} size="sm" selected={category === c.value} onPress={() => setCategory(c.value)} />
            ))}
          </View>
        </View>

        {members.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Concerne (optionnel)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {members.map((m) => (
                <Chip key={m.id} label={m.name} size="sm" selected={memberId === m.id} onPress={() => setMemberId(memberId === m.id ? null : m.id)} />
              ))}
            </View>
          </View>
        )}

        {!isValid && (
          <Text tone="muted" size={13} center>
            {existing ? "Un nom est nécessaire pour enregistrer." : "Choisis d'abord un fichier."}
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Ajouter le document"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
