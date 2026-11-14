import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "../components/Text";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BookIcon, PlusIcon } from "../components/icons";
import { useRecipes } from "../hooks/useApi";
import { color, space } from "../theme/tokens";

/** Recipe book content, shown in the « Repas » tab (and on /recipes). */
export function RecipesBody() {
  const { data: recipes = [] } = useRecipes();

  return (
    <View style={{ gap: space[2] }}>
        <Button label="Nouvelle recette" icon={<PlusIcon size={18} color={color.text} />} variant="secondary" block onPress={() => router.push("/recipe/new")} />

        {recipes.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
            <BookIcon size={22} color={color.neutral600} />
            <Text tone="muted" size={13} center style={{ marginTop: space[2] }}>
              Aucune recette pour l'instant.
            </Text>
          </Card>
        )}

        {recipes.map((recipe) => (
          <Pressable key={recipe.id} onPress={() => router.push(`/recipe/${recipe.id}`)}>
            <Card row style={{ alignItems: "center" }}>
              <BookIcon size={14} color={color.accent400} />
              <View style={{ flex: 1, marginLeft: space[2] }}>
                <Text size={14} weight="medium">
                  {recipe.title}
                </Text>
                <Text size={11.5} tone="faint">
                  {recipe.ingredients.length} ingrédient{recipe.ingredients.length !== 1 ? "s" : ""} · {recipe.steps.length} étape{recipe.steps.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
    </View>
  );
}
