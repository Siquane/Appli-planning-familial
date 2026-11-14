import { Alert, ScrollView, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { BulletIcon } from "../../src/components/icons";
import { Card } from "../../src/components/Card";
import { TopBar } from "../../src/components/TopBar";
import { Avatar } from "../../src/components/Avatar";
import { DocumentRow } from "../../src/components/DocumentRow";
import { FileSourceButtons } from "../../src/components/FileSourceButtons";
import { useDeleteDocument, useDeleteRecipe, useDocuments, useMembers, useRecipes, useUploadDocument } from "../../src/hooks/useApi";
import { formatSize, type PickedFile } from "../../src/lib/documentUpload";
import type { FamilyDocument } from "../../src/api/types";
import { useToastStore } from "../../src/state/toastStore";
import { color, space } from "../../src/theme/tokens";
import { errorText } from "../../src/lib/errors";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recipes = [] } = useRecipes();
  const { data: members = [] } = useMembers();
  const deleteRecipe = useDeleteRecipe();
  const { data: attachments = [] } = useDocuments(id);
  const uploadAttachment = useUploadDocument();
  const deleteAttachment = useDeleteDocument();
  const recipe = recipes.find((r) => r.id === id);

  if (!recipe) {
    return (
      <Screen scroll={false}>
        <TopBar title="Recette" onBack={() => router.back()} />
        <Text tone="muted" style={{ padding: 22 }}>
          Cette recette n'existe plus.
        </Text>
      </Screen>
    );
  }

  const fans = recipe.memberIds.map((mid) => members.find((m) => m.id === mid)).filter((m): m is NonNullable<typeof m> => !!m);

  function onDelete() {
    Alert.alert("Supprimer la recette", `Supprimer « ${recipe!.title} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          deleteRecipe.mutate(recipe!.id, {
            onSuccess: () => {
              useToastStore.getState().show("Recette supprimée.");
              router.back();
            },
          });
        },
      },
    ]);
  }

  async function onAttach(file: PickedFile) {
    try {
      await uploadAttachment.mutateAsync({ file, data: { recipeId: recipe!.id } });
      useToastStore.getState().show("Pièce jointe ajoutée.");
    } catch (e) {
      useToastStore.getState().show(errorText(e, "ajouter la pièce jointe"));
    }
  }

  function onRemoveAttachment(doc: FamilyDocument) {
    Alert.alert("Retirer la pièce jointe", `Supprimer « ${doc.title} » ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteAttachment.mutate(doc.id) },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={recipe.title} onBack={() => router.back()} onEdit={() => router.push(`/recipe/new?edit=${recipe.id}`)} onDelete={onDelete} />
      <ScrollView contentContainerStyle={{ padding: 22, gap: space[4] }} showsVerticalScrollIndicator={false}>
        {fans.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Qui aime ce plat
            </Text>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              {fans.map((m) => (
                <View key={m.id} style={{ alignItems: "center", gap: 4 }}>
                  <Avatar initials={m.initials} bg={m.tint === "neutral" ? color.neutral700 : color.accent800} fg={m.tint === "neutral" ? color.neutral100 : color.accent100} size={32} />
                  <Text size={11} tone="muted">
                    {m.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {recipe.ingredients.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Ingrédients
            </Text>
            <Card style={{ gap: space[2] }}>
              {recipe.ingredients.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
                  <BulletIcon size={8} color={color.accent400} />
                  <Text size={15} style={{ flex: 1 }}>
                    {item}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {recipe.steps.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Étapes
            </Text>
            <Card style={{ gap: space[2] }}>
              {recipe.steps.map((item, i) => (
                <Text key={i} size={15}>
                  {i + 1}. {item}
                </Text>
              ))}
            </Card>
          </View>
        )}

        {recipe.notes ? (
          <View style={{ gap: space[2] }}>
            <Text weight="medium" size={13} tone="muted">
              Notes
            </Text>
            <Text size={15}>{recipe.notes}</Text>
          </View>
        ) : null}

        <View style={{ gap: space[2] }}>
          <Text weight="medium" size={13} tone="muted">
            Pièces jointes
          </Text>
          {attachments.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              subtitle={`${formatSize(doc.size)} · appui long pour supprimer`}
              onPress={() => doc.url && WebBrowser.openBrowserAsync(doc.url)}
              onLongPress={() => onRemoveAttachment(doc)}
            />
          ))}
          {uploadAttachment.isPending ? (
            <Text size={13} tone="muted">
              Envoi en cours…
            </Text>
          ) : (
            <FileSourceButtons onPicked={onAttach} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
