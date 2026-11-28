import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { Screen } from "../../src/components/Screen";
import { Segmented } from "../../src/components/Segmented";
import { useShoppingList } from "../../src/hooks/useApi";
import { TabHeader } from "../../src/components/PageHeader";
import { MealsBody } from "../../src/screens/MealsBody";
import { RecipesBody } from "../../src/screens/RecipesBody";
import { ShoppingBody } from "../../src/screens/ShoppingBody";
import { color, space, gutter } from "../../src/theme/tokens";

type View_ = "menu" | "recettes" | "courses";

// « Repas » tab: weekly menu, recipe book and shopping list.
export default function RepasTab() {
  const [view, setView] = useState<View_>("menu");
  // The shopping-list widget opens /repas?tab=courses.
  const { tab, w } = useLocalSearchParams<{ tab?: string; w?: string }>();
  useEffect(() => {
    if (tab === "menu" || tab === "recettes" || tab === "courses") setView(tab);
  }, [tab, w]);

  const { data: shopping = [] } = useShoppingList();
  const toBuy = shopping.filter((i) => !i.checked).length;

  return (
    <Screen scroll={false} padded={false} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <TabHeader title="Repas" />
        <Segmented
          tint={color.pillar2}
          value={view}
          onChange={setView}
          items={[
            { key: "menu", label: "Menu" },
            { key: "recettes", label: "Recettes" },
            { key: "courses", label: "Courses", badge: toBuy },
          ]}
        />
        {view === "menu" ? <MealsBody onOpenShopping={() => setView("courses")} /> : view === "recettes" ? <RecipesBody /> : <ShoppingBody />}
      </ScrollView>
    </Screen>
  );
}
