import type { Appetite, Member, MemberDiet } from "../api/types";

// Per-member food preferences shown in the « Repas » section of a member's
// page, and sent (without names) to the menu generator.

export const MEMBER_DIET_OPTIONS: { value: MemberDiet; label: string }[] = [
  { value: "végétarien", label: "Végétarien" },
  { value: "vegan", label: "Vegan" },
  { value: "sans-porc", label: "Sans porc" },
  { value: "halal", label: "Halal" },
  { value: "casher", label: "Casher" },
  { value: "sans-gluten", label: "Sans gluten" },
  { value: "sans-lactose", label: "Sans lactose" },
];

export const APPETITE_OPTIONS: { value: Appetite; label: string }[] = [
  { value: "petit", label: "Petit appétit" },
  { value: "moyen", label: "Moyen" },
  { value: "gros", label: "Gros appétit" },
];

/** School days only: lunch at the canteen. 0 = lundi … 4 = vendredi. */
export const CANTEEN_DAY_OPTIONS = [
  { value: 0, label: "Lun" },
  { value: 1, label: "Mar" },
  { value: 2, label: "Mer" },
  { value: 3, label: "Jeu" },
  { value: 4, label: "Ven" },
];

type FoodFields = Pick<
  Member,
  "favoriteFoods" | "dislikedFoods" | "appetite" | "canteenDays" | "foodNotes" | "diets" | "allergies" | "foodsToLimit"
>;

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
/** "pâtes, pizza ; crêpes" -> 3 items (commas, semicolons and line breaks separate). */
const countItems = (text: string) => text.split(/[,;\n]/).filter((t) => t.trim()).length;

/** One-line summary shown on the folded « Repas » section, e.g. « 2 aime · 1 allergie ». */
export function foodSummary(m: FoodFields): string {
  const parts: string[] = [];
  const likes = countItems(m.favoriteFoods);
  const dislikes = countItems(m.dislikedFoods);
  const allergies = countItems(m.allergies);
  if (likes) parts.push(plural(likes, "plat préféré", "plats préférés"));
  if (dislikes) parts.push(`${dislikes} n'aime pas`);
  if (m.diets.length) parts.push(plural(m.diets.length, "régime", "régimes"));
  if (allergies) parts.push(plural(allergies, "allergie", "allergies"));
  if (m.foodsToLimit.trim()) parts.push("à limiter");
  if (m.canteenDays.length) parts.push(`cantine ${m.canteenDays.length} j`);
  if (m.appetite) parts.push(APPETITE_OPTIONS.find((o) => o.value === m.appetite)!.label.toLowerCase());
  if (m.foodNotes.trim()) parts.push("note");
  return parts.length ? parts.join(" · ") : "Rien de renseigné";
}

/** Toggle a value in a list (multi-select chips). */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
