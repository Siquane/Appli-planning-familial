import { Alert, Image, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { DocumentIcon } from "../../src/components/icons";
import { useDeleteDocument, useDocuments, useMembers } from "../../src/hooks/useApi";
import { categoryLabel, formatSize, isImage } from "../../src/lib/documentUpload";
import { useToastStore } from "../../src/state/toastStore";
import { color, radius, space } from "../../src/theme/tokens";

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: documents = [] } = useDocuments();
  const { data: members = [] } = useMembers();
  const deleteDocument = useDeleteDocument();
  const doc = documents.find((d) => d.id === id);

  if (!doc) {
    return (
      <Screen scroll={false}>
        <TopBar title="Document" onBack={() => router.back()} />
        <Text tone="muted" style={{ padding: 22 }}>
          Ce document n'existe plus.
        </Text>
      </Screen>
    );
  }

  const member = doc.memberId ? members.find((m) => m.id === doc.memberId) : undefined;

  function onDelete() {
    Alert.alert("Supprimer le document", `Supprimer « ${doc!.title} » ? Le fichier sera effacé.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteDocument.mutate(doc!.id, {
            onSuccess: () => {
              useToastStore.getState().show("Document supprimé.");
              router.back();
            },
          });
        },
      },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={doc.title} onBack={() => router.back()} onEdit={() => router.push(`/document/new?edit=${doc.id}`)} onDelete={onDelete} />
      <ScrollView contentContainerStyle={{ padding: 22, gap: space[4] }} showsVerticalScrollIndicator={false}>
        {isImage(doc) && doc.url ? (
          <Image source={{ uri: doc.url }} resizeMode="contain" style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md, backgroundColor: color.surface }} />
        ) : (
          <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
            <DocumentIcon size={32} color={color.accent400} />
            <Text size={13} tone="muted" style={{ marginTop: space[2] }}>
              {doc.fileName}
            </Text>
          </Card>
        )}

        {doc.url && <Button label="Ouvrir le fichier" variant="primary" block onPress={() => WebBrowser.openBrowserAsync(doc.url!)} />}

        <Card style={{ gap: space[2] }}>
          <Row label="Catégorie" value={categoryLabel(doc.category)} />
          {member && <Row label="Concerne" value={member.name} />}
          <Row label="Ajouté le" value={new Date(doc.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} />
          <Row label="Taille" value={formatSize(doc.size)} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <Text size={13}>{value}</Text>
    </View>
  );
}
