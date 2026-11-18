import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { ListEditor } from "../../src/components/ListEditor";
import { Chip } from "../../src/components/Chip";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useCreateRecipe, useMembers, useRecipes, useUpdateRecipe } from "../../src/hooks/useApi";
import { useToastStore } from "../../src/state/toastStore";
import { space, gutter } from "../../src/theme/tokens";
import type { Recipe } from "../../src/api/types";
import { recipesApi } from "../../src/api/resources";
import { Card } from "../../src/components/Card";
import { errorText } from "../../src/lib/errors";

export default function RecipeFormScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { data: recipes = [] } = useRecipes();
  const { data: members = [] } = useMembers();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  const existing: Recipe | undefined = useMemo(() => recipes.find((r) => r.id === edit), [recipes, edit]);

  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [steps, setSteps] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  // Fills the form from a recipe web page; nothing is saved until « Créer ».
  async function onImport() {
    const url = importUrl.trim();
    if (!url) return;
    setImporting(true);
    try {
      const { recipe } = await recipesApi.importFromUrl(/^https?:\/\//i.test(url) ? url : `https://${url}`);
      setTitle(recipe.title);
      setIngredients(recipe.ingredients);
      setSteps(recipe.steps);
      if (recipe.notes) setNotes((n) => (n ? `${n}\n${recipe.notes}` : recipe.notes));
      setImportUrl("");
      useToastStore.getState().show("Recette importée : vérifie-la puis enregistre.");
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Impossible de lire cette recette. Vérifie le lien, ou saisis-la à la main.");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setIngredients(existing.ingredients);
    setSteps(existing.steps);
    setNotes(existing.notes);
    setMemberIds(existing.memberIds);
  }, [existing]);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const isValid = title.trim().length > 0;
  const saving = createRecipe.isPending || updateRecipe.isPending;

  async function onSave() {
    const data = { title: title.trim(), ingredients, steps, notes, memberIds };
    try {
      if (existing) {
        await updateRecipe.mutateAsync({ id: existing.id, data });
        useToastStore.getState().show("Recette modifiée.");
      } else {
        await createRecipe.mutateAsync(data);
        useToastStore.getState().show("Recette ajoutée.");
      }
      router.back();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer la recette"));
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Modifier la recette" : "Nouvelle recette"} onBack={() => router.back()} save={{ onPress: onSave, disabled: !isValid, loading: saving, needsNetwork: true }} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        {!existing && (
          <Card style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Importer depuis un site de recettes (facultatif)
            </Text>
            <TextField value={importUrl} onChangeText={setImportUrl} placeholder="Coller le lien de la recette" autoCapitalize="none" keyboardType="url" />
            <Button label="Importer" variant="secondary" block onPress={onImport} disabled={!importUrl.trim()} loading={importing} needsNetwork />
          </Card>
        )}

        <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Gratin de courgettes" />

        <ListEditor label="Ingrédients" placeholder="Ex. 2 courgettes" items={ingredients} onChange={setIngredients} />

        <ListEditor label="Étapes" placeholder="Ex. Couper les courgettes en rondelles" items={steps} onChange={setSteps} numbered />

        {members.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Qui aime ce plat ? (facultatif)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {members.map((m) => (
                <Chip key={m.id} label={m.name} selected={memberIds.includes(m.id)} onPress={() => toggleMember(m.id)} size="sm" />
              ))}
            </View>
          </View>
        )}

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Astuces, variantes..." />

        {!isValid && (
          <Text tone="muted" size={13} center>
            Un titre est nécessaire pour {existing ? "enregistrer" : "créer la recette"}.
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Créer la recette"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} needsNetwork />
      </KeyboardScrollView>
    </Screen>
  );
}
