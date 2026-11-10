import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import type { Meal } from "@prisma/client";
import { isMealAiConfigured } from "../env";
import { COOK_TIMES, DIETS, MealPlannerError, RECIPE_USAGE, proposeMeals } from "../services/mealPlanner";

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

const MEAL_TYPES = ["petit-déjeuner", "déjeuner", "goûter", "dîner"] as const;

function serializeMeal(meal: Meal) {
  return {
    id: meal.id,
    weekday: meal.weekday,
    type: meal.type,
    title: meal.title,
    recipeId: meal.recipeId,
    notes: meal.notes,
  };
}

mealsRouter.get("/", async (req, res) => {
  const meals = await prisma.meal.findMany({ where: { userId: req.userId }, orderBy: [{ weekday: "asc" }] });
  res.json({ meals: meals.map(serializeMeal) });
});

const mealSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  type: z.enum(MEAL_TYPES),
  title: z.string().default(""),
  recipeId: z.string().nullable().optional(),
  notes: z.string().default(""),
});

// Upsert: one meal per (weekday, type) slot — setting a slot that already
// has a meal replaces it, same as editing it directly.
mealsRouter.post("/", async (req, res) => {
  const parsed = mealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;

  if (d.recipeId) {
    const recipe = await prisma.recipe.findFirst({ where: { id: d.recipeId, userId: req.userId } });
    if (!recipe) return res.status(400).json({ error: "Recette introuvable" });
  }

  const meal = await prisma.meal.upsert({
    where: { userId_weekday_type: { userId: req.userId!, weekday: d.weekday, type: d.type } },
    update: { title: d.title, recipeId: d.recipeId ?? null, notes: d.notes },
    create: { userId: req.userId!, weekday: d.weekday, type: d.type, title: d.title, recipeId: d.recipeId ?? null, notes: d.notes },
  });
  res.status(201).json({ meal: serializeMeal(meal) });
});

mealsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  await prisma.meal.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const slotSchema = z.object({ weekday: z.number().int().min(0).max(6), type: z.enum(MEAL_TYPES) });

const generateSchema = z.object({
  slots: z.array(slotSchema).min(1, "Choisis au moins un repas à remplir").max(28),
  preferences: z.object({
    diets: z.array(z.enum(DIETS)).default([]),
    allergies: z.string().max(300).default(""),
    weekdayTime: z.enum(COOK_TIMES).default("normal"),
    weekendTime: z.enum(COOK_TIMES).default("normal"),
    fishPerWeek: z.number().int().min(0).max(14).nullable().default(null),
    veggiePerWeek: z.number().int().min(0).max(14).nullable().default(null),
    useMyRecipes: z.enum(RECIPE_USAGE).default("parfois"),
    wishes: z.string().max(500).default(""),
    avoid: z.string().max(500).default(""),
  }),
  // Dish titles to steer away from (used when re-rolling a single slot).
  exclude: z.array(z.string().max(120)).max(40).default([]),
});

// Asks Claude for a proposal. Nothing is written: the app previews it and
// saves the accepted meals through POST /meals/bulk.
mealsRouter.post("/generate", async (req, res) => {
  if (!isMealAiConfigured()) return res.status(503).json({ error: "La génération de menus n'est pas configurée sur le serveur." });
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { slots, preferences, exclude } = parsed.data;

  const [recipes, members, meals] = await Promise.all([
    prisma.recipe.findMany({ where: { userId: req.userId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.familyMember.findMany({ where: { userId: req.userId }, select: { name: true, age: true }, orderBy: { order: "asc" } }),
    prisma.meal.findMany({ where: { userId: req.userId }, include: { recipe: { select: { title: true } } } }),
  ]);
  const requested = new Set(slots.map((s) => `${s.weekday}|${s.type}`));
  const keptMeals = meals
    .filter((m) => !requested.has(`${m.weekday}|${m.type}`))
    .map((m) => ({ weekday: m.weekday, type: m.type, title: m.recipe?.title ?? m.title }))
    .filter((m) => m.title);

  try {
    const proposal = await proposeMeals({ slots, preferences, recipes, members, keptMeals, exclude });
    res.json({ meals: proposal });
  } catch (e) {
    if (e instanceof MealPlannerError) return res.status(502).json({ error: e.message });
    throw e;
  }
});

const bulkSchema = z.object({ meals: z.array(mealSchema).min(1).max(28) });

// Saves an accepted proposal in one go (same upsert-per-slot rule as POST /).
mealsRouter.post("/bulk", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const items = parsed.data.meals;

  const recipeIds = [...new Set(items.map((m) => m.recipeId).filter((id): id is string => !!id))];
  if (recipeIds.length) {
    const owned = await prisma.recipe.count({ where: { id: { in: recipeIds }, userId: req.userId } });
    if (owned !== recipeIds.length) return res.status(400).json({ error: "Recette introuvable" });
  }

  const saved = await prisma.$transaction(
    items.map((d) =>
      prisma.meal.upsert({
        where: { userId_weekday_type: { userId: req.userId!, weekday: d.weekday, type: d.type } },
        update: { title: d.title, recipeId: d.recipeId ?? null, notes: d.notes },
        create: { userId: req.userId!, weekday: d.weekday, type: d.type, title: d.title, recipeId: d.recipeId ?? null, notes: d.notes },
      }),
    ),
  );
  res.status(201).json({ meals: saved.map(serializeMeal) });
});
