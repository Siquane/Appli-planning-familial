import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TopBar } from "../src/components/TopBar";
import { RecipesBody } from "../src/screens/RecipesBody";
import { gutter } from "../src/theme/tokens";

export default function RecipesScreen() {
  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Livre de recettes" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter }} showsVerticalScrollIndicator={false}>
        <RecipesBody />
      </ScrollView>
    </Screen>
  );
}
