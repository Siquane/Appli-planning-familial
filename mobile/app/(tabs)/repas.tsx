import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Chip } from "../../src/components/Chip";
import { TabHeader } from "../../src/components/PageHeader";
import { MealsBody } from "../../src/screens/MealsBody";
import { RecipesBody } from "../../src/screens/RecipesBody";
import { ShoppingBody } from "../../src/screens/ShoppingBody";
import { space } from "../../src/theme/tokens";

type View_ = "menu" | "recettes" | "courses";

// « Repas » tab: weekly menu, recipe book and shopping list.
export default function RepasTab() {
  const [view, setView] = useState<View_>("menu");
  // The shopping-list widget opens /repas?tab=courses.
  const { tab, w } = useLocalSearchParams<{ tab?: string; w?: string }>();
  useEffect(() => {
    if (tab === "menu" || tab === "recettes" || tab === "courses") setView(tab);
  }, [tab, w]);

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Repas" />
        <View style={{ flexDirection: "row", gap: space[1] }}>
          <Chip label="Menu" selected={view === "menu"} onPress={() => setView("menu")} fill />
          <Chip label="Recettes" selected={view === "recettes"} onPress={() => setView("recettes")} fill />
          <Chip label="Courses" selected={view === "courses"} onPress={() => setView("courses")} fill />
        </View>
        {view === "menu" ? <MealsBody /> : view === "recettes" ? <RecipesBody /> : <ShoppingBody />}
      </ScrollView>
    </Screen>
  );
}
