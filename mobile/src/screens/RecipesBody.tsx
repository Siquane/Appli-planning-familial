import { View } from "react-native";
import { Pressable } from "../components/Touchable";
import { router } from "expo-router";
import { Text } from "../components/Text";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { BookIcon, PlusIcon } from "../components/icons";
import { useRecipes } from "../hooks/useApi";
import { color, space } from "../theme/tokens";
import { EmptyState } from "../components/Playful";

/** Recipe book content, shown in the « Repas » tab (and on /recipes). */
export function RecipesBody() {
  const { data: recipes = [] } = useRecipes();

  return (
    <View style={{ gap: space.sm }}>
        <Button label="Nouvelle recette" icon={<PlusIcon size={18} color={color.text} />} variant="secondary" block onPress={() => router.push("/recipe/new")} />

        {recipes.length === 0 && (
          <Card>
            <EmptyState title="Le livre est encore vierge 📖" detail="Ajoute ta première recette, ou importe-la depuis un lien." />
          </Card>
        )}

        {recipes.map((recipe) => (
          <Pressable key={recipe.id} onPress={() => router.push(`/recipe/${recipe.id}`)}>
            <Card row style={{ alignItems: "center" }}>
              <BookIcon size={14} color={color.accent400} />
              <View style={{ flex: 1, marginLeft: space.sm }}>
                <Text size={15} weight="medium">
                  {recipe.title}
                </Text>
                <Text size={12} tone="faint">
                  {recipe.ingredients.length} ingrédient{recipe.ingredients.length !== 1 ? "s" : ""} · {recipe.steps.length} étape{recipe.steps.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </Card>
          </Pressable>
        ))}
    </View>
  );
}
