import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Chip } from "../../src/components/Chip";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useDeleteMeal, useMeals, useRecipes, useSetMeal } from "../../src/hooks/useApi";
import { useToastStore } from "../../src/state/toastStore";
import { space } from "../../src/theme/tokens";
import { WEEKDAYS_FULL } from "../../src/lib/weekdays";
import type { MealType, Weekday } from "../../src/api/types";

export default function MealEditScreen() {
  const { weekday: weekdayParam, type } = useLocalSearchParams<{ weekday: string; type: MealType }>();
  const weekday = Number(weekdayParam) as Weekday;

  const { data: meals = [] } = useMeals();
  const { data: recipes = [] } = useRecipes();
  const setMeal = useSetMeal();
  const deleteMeal = useDeleteMeal();

  const existing = useMemo(() => meals.find((m) => m.weekday === weekday && m.type === type), [meals, weekday, type]);

  const [title, setTitle] = useState("");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setRecipeId(existing.recipeId);
    setNotes(existing.notes);
  }, [existing]);

  const saving = setMeal.isPending || deleteMeal.isPending;

  async function onSave() {
    try {
      await setMeal.mutateAsync({ weekday, type, title: title.trim(), recipeId, notes });
      useToastStore.getState().show("Repas enregistré.");
      router.back();
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  async function onClear() {
    if (!existing) {
      router.back();
      return;
    }
    await deleteMeal.mutateAsync(existing.id);
    useToastStore.getState().show("Repas supprimé.");
    router.back();
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={`${type} · ${WEEKDAYS_FULL[weekday]}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Pâtes bolognaise" />

        {recipes.length > 0 && (
          <View style={{ gap: space[2] }}>
            <Text size={13} tone="muted">
              Lier une recette (optionnel)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
              <Chip label="Aucune" selected={recipeId === null} onPress={() => setRecipeId(null)} size="sm" />
              {recipes.map((r) => (
                <Chip key={r.id} label={r.title} selected={recipeId === r.id} onPress={() => setRecipeId(r.id)} size="sm" />
              ))}
            </View>
          </View>
        )}

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Allergies, portions, à préparer la veille..." />

        <Button label="Enregistrer" variant="primary" block onPress={onSave} loading={saving} />
        {existing && <Button label="Supprimer ce repas" variant="secondary" block onPress={onClear} loading={saving} />}
      </ScrollView>
    </Screen>
  );
}
