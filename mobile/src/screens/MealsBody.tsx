import { useState } from "react";
import { Pressable } from "../components/Touchable";
import { View } from "react-native";
import { router } from "expo-router";
import { Text } from "../components/Text";
import { Card } from "../components/Card";
import { WeekStrip } from "../components/WeekStrip";
import { ChevronRightIcon, MealIcon, PlusIcon, SchoolBagIcon, SparkleIcon } from "../components/icons";
import { Button } from "../components/Button";
import { WeekNav } from "../components/WeekNav";
import { AvatarStack } from "../components/Avatar";
import { useMeals, useMembers, useRecipes, useShoppingList } from "../hooks/useApi";
import { todayWeekday, WEEKDAYS_FULL } from "../lib/weekdays";
import { weekKey } from "../lib/stars";
import { dayOfWeek } from "../lib/weekdays";
import { shortDate } from "../lib/appointments";
import { useMenuWeek, useMenuWeekStore } from "../state/menuWeekStore";
import { color, radius, space } from "../theme/tokens";
import type { Meal, MealType, Recipe, Weekday } from "../api/types";

const MEAL_TYPES: { type: MealType; short: string; label: string }[] = [
  { type: "petit-déjeuner", short: "Matin", label: "Petit-déjeuner" },
  { type: "déjeuner", short: "Midi", label: "Déjeuner" },
  { type: "goûter", short: "16 h", label: "Goûter" },
  { type: "dîner", short: "Soir", label: "Dîner" },
];

const tint = () => color.pillar2;

/**
 * Menu d'une semaine (chaque semaine a le sien), dans l'onglet « Repas » :
 * le dîner du jour choisi en haut, la semaine (un point sous les jours qui ont
 * leur dîner), les repas du jour, puis les courses.
 */
export function MealsBody({ onOpenShopping }: { onOpenShopping?: () => void }) {
  const today = todayWeekday();
  const [selected, setSelected] = useState<Weekday>(today);
  const offset = useMenuWeekStore((s) => s.offset);
  const setOffset = useMenuWeekStore((s) => s.setOffset);
  const week = useMenuWeek();
  const current = weekKey();
  const { data: meals = [], isLoading } = useMeals(week);
  const { data: recipes = [] } = useRecipes();
  const { data: members = [] } = useMembers();
  const { data: shopping = [] } = useShoppingList();
  const empty = !isLoading && meals.length === 0;
  const isToday = offset === 0 && selected === today;

  const find = (type: MealType): { meal?: Meal; recipe?: Recipe; label?: string } => {
    const meal = meals.find((m) => m.weekday === selected && m.type === type);
    const recipe = meal?.recipeId ? recipes.find((r) => r.id === meal.recipeId) : undefined;
    return { meal, recipe, label: recipe?.title ?? (meal?.title || undefined) };
  };
  const editHref = (type: MealType) => `/meal/edit?week=${week}&weekday=${selected}&type=${encodeURIComponent(type)}`;
  const dinner = find("dîner");
  const dinnerMarks = Array.from({ length: 7 }, (_, d) => meals.some((m) => m.weekday === d && m.type === "dîner"));
  // Enfants à la cantine ce jour-là (lundi à vendredi), quand rien n'est prévu le midi.
  const canteen = members.filter((m) => m.canteenDays.includes(selected));
  const toBuy = shopping.filter((i) => !i.checked);

  return (
    <View style={{ gap: space.md }}>
      <Pressable
        onPress={() => router.push(dinner.recipe ? `/recipe/${dinner.recipe.id}` : editHref("dîner"))}
        accessibilityRole="button"
        accessibilityLabel={dinner.label ? `${isToday ? "Ce soir" : WEEKDAYS_FULL[selected] + " soir"} : ${dinner.label}` : "Dîner pas encore prévu, l'ajouter"}
      >
        <Card style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderWidth: 1, borderColor: tint() + "40", backgroundColor: color.surface }}>
          <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: tint() + "29", alignItems: "center", justifyContent: "center" }}>
            <MealIcon size={28} color={tint()} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={11} weight="semibold" style={{ color: tint(), letterSpacing: 0.6 }}>
              {isToday ? "CE SOIR" : `${WEEKDAYS_FULL[selected].toUpperCase()} SOIR`}
            </Text>
            <Text heading weight="semibold" size={17} numberOfLines={2} tone={dinner.label ? "text" : "muted"}>
              {dinner.label ?? "Pas encore de dîner"}
            </Text>
            <Text size={12} tone="faint" numberOfLines={1}>
              {dinner.recipe
                ? `Recette de la famille · ${dinner.recipe.ingredients.length} ingrédient${dinner.recipe.ingredients.length > 1 ? "s" : ""}`
                : dinner.meal?.ingredients.length
                  ? `${dinner.meal.ingredients.length} ingrédient${dinner.meal.ingredients.length > 1 ? "s" : ""} sur la liste`
                  : dinner.label
                    ? "Touche pour modifier"
                    : "Touche pour l'ajouter"}
            </Text>
          </View>
          <ChevronRightIcon size={14} color={color.neutral500} />
        </Card>
      </Pressable>

      <WeekNav week={week} current={current} onPrev={() => setOffset(offset - 1)} onNext={() => setOffset(offset + 1)} />
      <WeekStrip selected={selected} onSelect={setSelected} today={offset === 0 ? today : null} week={week} marks={dinnerMarks} tint={tint()} />

      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text heading weight="semibold" size={16}>
          {WEEKDAYS_FULL[selected]} {shortDate(dayOfWeek(week, selected))}
        </Text>
        {empty && (
          <Text size={12} tone="faint">
            Rien de prévu cette semaine
          </Text>
        )}
      </View>

      <View style={{ gap: space.sm }}>
        {MEAL_TYPES.map(({ type, short, label: typeLabel }) => {
          const { label } = find(type);
          const atCanteen = type === "déjeuner" && !label && canteen.length > 0;
          const highlight = type === "dîner" && isToday && !!label;
          return (
            <Pressable key={type} onPress={() => router.push(editHref(type))} accessibilityRole="button" accessibilityLabel={`${typeLabel} : ${label ?? (atCanteen ? "cantine" : "ajouter un repas")}`}>
              <Card
                row
                bracket={!highlight}
                style={{
                  alignItems: "center",
                  gap: space.md,
                  paddingVertical: space.md,
                  paddingHorizontal: space.md,
                  ...(atCanteen ? { borderWidth: 1, borderStyle: "dashed", borderColor: tint() + "59", backgroundColor: tint() + "12" } : null),
                  ...(highlight ? { borderWidth: 1.5, borderColor: tint(), boxShadow: `0 0 18px ${tint()}40` } : null),
                }}
              >
                <Text mono size={12} style={{ width: 52, color: highlight ? tint() : color.neutral400 }}>
                  {short}
                </Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text size={15} weight={label || atCanteen ? "medium" : "regular"} tone={label || atCanteen ? "text" : "faint"} numberOfLines={1}>
                    {label ?? (atCanteen ? "Cantine" : typeLabel)}
                  </Text>
                  {atCanteen && (
                    <AvatarStack
                      size={20}
                      bgBehind={color.surface}
                      avatars={canteen.map((m) => ({ initials: m.initials, bg: m.tint === "neutral" ? color.neutral700 : color.accent800, fg: m.tint === "neutral" ? color.neutral100 : color.accent100 }))}
                    />
                  )}
                </View>
                {atCanteen ? (
                  <SchoolBagIcon size={18} color={tint()} />
                ) : label ? (
                  <ChevronRightIcon size={14} color={color.neutral500} />
                ) : (
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.neutral600, alignItems: "center", justifyContent: "center" }}>
                    <PlusIcon size={12} color={color.neutral500} />
                  </View>
                )}
              </Card>
            </Pressable>
          );
        })}
      </View>

      {onOpenShopping && (
        <Pressable onPress={onOpenShopping} accessibilityRole="button" accessibilityLabel={toBuy.length ? `${toBuy.length} articles à acheter, voir les courses` : "Voir les courses"}>
          <Card row style={{ alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={14} weight="medium">
                {toBuy.length ? `${toBuy.length} article${toBuy.length > 1 ? "s" : ""} à acheter` : "Liste de courses à jour"}
              </Text>
              <Text size={12} tone="faint" numberOfLines={1}>
                {toBuy.length ? toBuy.slice(0, 4).map((i) => i.label).join(", ") + (toBuy.length > 4 ? "…" : "") : "Rien à acheter pour l'instant"}
              </Text>
            </View>
            <Text size={12} weight="semibold" style={{ color: tint() }}>
              Courses ›
            </Text>
          </Card>
        </Pressable>
      )}

      <Button
        label={empty ? "Proposer les menus de la semaine" : "Générer les menus de la semaine"}
        icon={<SparkleIcon size={18} color={color.onGradient} />}
        variant="primary"
        block
        onPress={() => router.push("/meal/plan")}
      />
      {empty && (
        <Text size={13} tone="muted" center>
          Passerelle évite les plats des deux semaines d'avant et d'après.
        </Text>
      )}
    </View>
  );
}
