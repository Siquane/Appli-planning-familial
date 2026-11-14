import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { TopBar } from "../src/components/TopBar";
import { MealsBody } from "../src/screens/MealsBody";
import { gutter } from "../src/theme/tokens";

export default function MealsScreen() {
  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Menu de la semaine" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter }} showsVerticalScrollIndicator={false}>
        <MealsBody />
      </ScrollView>
    </Screen>
  );
}
