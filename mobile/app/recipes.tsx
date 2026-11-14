import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TopBar } from "../src/components/TopBar";
import { RecipesBody } from "../src/screens/RecipesBody";

export default function RecipesScreen() {
  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Livre de recettes" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 22 }} showsVerticalScrollIndicator={false}>
        <RecipesBody />
      </ScrollView>
    </Screen>
  );
}
