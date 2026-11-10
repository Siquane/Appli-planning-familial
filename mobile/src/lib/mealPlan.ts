import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { Meal, MealPlanPreferences, MealSlot, MealType, Weekday } from "../api/types";

export const MEAL_TYPES: MealType[] = ["petit-déjeuner", "déjeuner", "goûter", "dîner"];

export const DIET_OPTIONS: { value: MealPlanPreferences["diets"][number]; label: string }[] = [
  { value: "végétarien", label: "Végétarien" },
  { value: "pescetarien", label: "Pescétarien" },
  { value: "sans-porc", label: "Sans porc" },
  { value: "halal", label: "Halal" },
  { value: "sans-gluten", label: "Sans gluten" },
  { value: "sans-lactose", label: "Sans lactose" },
];

export const COOK_TIME_OPTIONS: { value: MealPlanPreferences["weekdayTime"]; label: string }[] = [
  { value: "express", label: "Express (< 30 min)" },
  { value: "normal", label: "Normal" },
  { value: "élaboré", label: "J'ai le temps" },
];

export const RECIPE_USAGE_OPTIONS: { value: MealPlanPreferences["useMyRecipes"]; label: string }[] = [
  { value: "souvent", label: "Souvent" },
  { value: "parfois", label: "Parfois" },
  { value: "jamais", label: "Jamais" },
];

/** "Peu importe" (null) or a count per week. */
export const PER_WEEK_OPTIONS: { value: string; label: string }[] = [
  { value: "any", label: "Peu importe" },
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3+" },
];

export const DEFAULT_PREFERENCES: MealPlanPreferences = {
  diets: [],
  allergies: "",
  weekdayTime: "express",
  weekendTime: "normal",
  fishPerWeek: null,
  veggiePerWeek: null,
  useMyRecipes: "parfois",
  wishes: "",
  avoid: "",
};

export type FillMode = "empty" | "all";

/** The (day, meal) slots to ask for: every combination, or only the ones with no meal yet. */
export function buildSlots(days: Weekday[], types: MealType[], meals: Meal[], mode: FillMode): MealSlot[] {
  const slots: MealSlot[] = [];
  for (const weekday of [...days].sort()) {
    for (const type of MEAL_TYPES.filter((t) => types.includes(t))) {
      const taken = meals.some((m) => m.weekday === weekday && m.type === type && (m.title || m.recipeId));
      if (mode === "all" || !taken) slots.push({ weekday, type });
    }
  }
  return slots;
}

/** How many of the chosen slots already hold a meal (decides whether to ask "remplacer ?"). */
export function countFilled(days: Weekday[], types: MealType[], meals: Meal[]) {
  return buildSlots(days, types, meals, "all").length - buildSlots(days, types, meals, "empty").length;
}

// The answers are remembered on the device so next week is one tap.
const KEY = "passerelle.mealPlanPreferences";

export async function loadPreferences(): Promise<MealPlanPreferences> {
  try {
    const raw = Platform.OS === "web" ? (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) : await SecureStore.getItemAsync(KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<MealPlanPreferences>) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: MealPlanPreferences) {
  try {
    const raw = JSON.stringify(prefs);
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, raw);
      return;
    }
    await SecureStore.setItemAsync(KEY, raw);
  } catch {
    // Remembering answers is a convenience only.
  }
}
