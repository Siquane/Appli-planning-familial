import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "../components/Text";
import { Card } from "../components/Card";
import { WeekStrip } from "../components/WeekStrip";
import { ChevronRightIcon, SparkleIcon } from "../components/icons";
import { Button } from "../components/Button";
import { useMeals, useRecipes } from "../hooks/useApi";
import { todayWeekday } from "../lib/weekdays";
import { color, space } from "../theme/tokens";
import type { MealType, Weekday } from "../api/types";

const MEAL_TYPES: MealType[] = ["petit-déjeuner", "déjeuner", "goûter", "dîner"];

/** Weekly menu content, shown in the « Repas » tab (and on /meals). */
export function MealsBody() {
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  const { data: meals = [] } = useMeals();
  const { data: recipes = [] } = useRecipes();

  return (
      <View style={{ gap: space[4] }}>
        <Button label="Générer mes menus" icon={<SparkleIcon size={18} color={color.bg} />} variant="primary" block onPress={() => router.push("/meal/plan")} />
        <WeekStrip selected={selected} onSelect={setSelected} today={today} />

        <View style={{ gap: space[2] }}>
          {MEAL_TYPES.map((type) => {
            const meal = meals.find((m) => m.weekday === selected && m.type === type);
            const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined;
            const label = recipe?.title ?? meal?.title;
            return (
              <Pressable
                key={type}
                onPress={() => router.push(`/meal/edit?weekday=${selected}&type=${encodeURIComponent(type)}`)}
              >
                <Card row style={{ alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text size={11.5} tone="faint" style={{ textTransform: "capitalize" }}>
                      {type}
                    </Text>
                    <Text size={14} weight="medium" tone={label ? "text" : "muted"}>
                      {label ?? "Ajouter un repas"}
                    </Text>
                  </View>
                  <ChevronRightIcon size={14} color={color.neutral500} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      </View>
  );
}
