import { useState } from "react";
import { Pressable } from "../components/Touchable";
import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "../components/Text";
import { Card } from "../components/Card";
import { WeekStrip } from "../components/WeekStrip";
import { ChevronRightIcon, SparkleIcon } from "../components/icons";
import { Button } from "../components/Button";
import { WeekNav } from "../components/WeekNav";
import { useMeals, useRecipes } from "../hooks/useApi";
import { todayWeekday } from "../lib/weekdays";
import { weekKey } from "../lib/stars";
import { useMenuWeek, useMenuWeekStore } from "../state/menuWeekStore";
import { color, space } from "../theme/tokens";
import type { MealType, Weekday } from "../api/types";

const MEAL_TYPES: MealType[] = ["petit-déjeuner", "déjeuner", "goûter", "dîner"];

/** Menu d'une semaine (chaque semaine a le sien), dans l'onglet « Repas ». */
export function MealsBody() {
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  const offset = useMenuWeekStore((s) => s.offset);
  const setOffset = useMenuWeekStore((s) => s.setOffset);
  const week = useMenuWeek();
  const current = weekKey();
  const { data: meals = [], isLoading } = useMeals(week);
  const { data: recipes = [] } = useRecipes();
  const empty = !isLoading && meals.length === 0;

  return (
      <View style={{ gap: space.md }}>
        <WeekNav week={week} current={current} onPrev={() => setOffset(offset - 1)} onNext={() => setOffset(offset + 1)} />
        <Button
          label={empty ? "Proposer les menus de la semaine" : "Générer mes menus"}
          icon={<SparkleIcon size={18} color={color.onGradient} />}
          variant="primary"
          block
          onPress={() => router.push("/meal/plan")}
        />
        {empty && (
          <Text size={13} tone="muted" center>
            Rien de prévu cette semaine-là. Passerelle évite les plats des deux semaines d'avant et d'après.
          </Text>
        )}
        <WeekStrip selected={selected} onSelect={setSelected} today={offset === 0 ? today : null} week={week} />

        <View style={{ gap: space.sm }}>
          {MEAL_TYPES.map((type) => {
            const meal = meals.find((m) => m.weekday === selected && m.type === type);
            const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined;
            const label = recipe?.title ?? meal?.title;
            return (
              <Pressable
                key={type}
                onPress={() => router.push(`/meal/edit?week=${week}&weekday=${selected}&type=${encodeURIComponent(type)}`)}
                accessibilityRole="button"
                accessibilityLabel={`${type} : ${label ?? "ajouter un repas"}`}
              >
                <Card row style={{ alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text size={11} tone="faint" style={{ textTransform: "capitalize" }}>
                      {type}
                    </Text>
                    <Text size={15} weight="medium" tone={label ? "text" : "muted"}>
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
