import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import type { Meal } from "@prisma/client";
import { isMealAiConfigured } from "../env";
import { COOK_TIMES, DIETS, MealPlannerError, RECIPE_USAGE, anonymizeMembers, proposeMeals } from "../services/mealPlanner";
import { getMealQuota, quotaProblem } from "../lib/plan";
import { addDays, mondayOf, parisDay } from "../lib/cervelle/days";
import { isMondayKey } from "../lib/stars";

export const mealsRouter = Router();
mealsRouter.use(requireAuth);

const MEAL_TYPES = ["petit-déjeuner", "déjeuner", "goûter", "dîner"] as const;

// Chaque semaine a son propre menu, rangé sous son lundi (« AAAA-MM-JJ »).
// Sans semaine précisée (anciennes versions de l'appli) : la semaine en cours.
const weekKey = z.string().refine(isMondayKey, "Semaine invalide");
const currentWeek = () => mondayOf(parisDay());
const weekFrom = (value: unknown) => (typeof value === "string" && isMondayKey(value) ? value : currentWeek());
/** Semaines voisines dont on évite de répéter les plats : deux avant, deux après. */
const NEIGHBOUR_WEEKS = 2;

function serializeMeal(meal: Meal) {
  return {
    id: meal.id,
    week: meal.week,
    weekday: meal.weekday,
    type: meal.type,
    title: meal.title,
    recipeId: meal.recipeId,
    notes: meal.notes,
    ingredients: meal.ingredients,
  };
}

mealsRouter.get("/", async (req, res) => {
  const meals = await prisma.meal.findMany({ where: { userId: req.userId, week: weekFrom(req.query.week) }, orderBy: [{ weekday: "asc" }] });
  res.json({ meals: meals.map(serializeMeal) });
});

const mealSchema = z.object({
  week: weekKey.optional(),
  weekday: z.number().int().min(0).max(6),
  type: z.enum(MEAL_TYPES),
  title: z.string().default(""),
  recipeId: z.string().nullable().optional(),
  notes: z.string().default(""),
  ingredients: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
});

// Upsert: one meal per (weekday, type) slot — setting a slot that already
// has a meal replaces it, same as editing it directly.
mealsRouter.post("/", async (req, res) => {
  const parsed = mealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;

  if (d.recipeId) {
    const recipe = await prisma.recipe.findFirst({ where: { id: d.recipeId, userId: req.userId } });
    if (!recipe) return res.status(400).json({ error: "Cette recette n'existe plus. Elle a peut-être été supprimée." });
  }

  // Without a new list, ingredients follow the dish: kept while its title is
  // unchanged (only the notes were edited), dropped when it becomes another dish.
  const week = d.week ?? currentWeek();
  const slot = { userId_week_weekday_type: { userId: req.userId!, week, weekday: d.weekday, type: d.type } };
  const current = d.ingredients ? null : await prisma.meal.findUnique({ where: slot, select: { title: true, ingredients: true } });
  const ingredients = d.ingredients ?? (current && current.title === d.title ? current.ingredients : []);

  const meal = await prisma.meal.upsert({
    where: slot,
    update: { title: d.title, recipeId: d.recipeId ?? null, notes: d.notes, ingredients },
    create: { userId: req.userId!, week, weekday: d.weekday, type: d.type, title: d.title, recipeId: d.recipeId ?? null, notes: d.notes, ingredients },
  });
  res.status(201).json({ meal: serializeMeal(meal) });
});

mealsRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.meal.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  await prisma.meal.delete({ where: { id: existing.id } });
  res.status(204).end();
});

const slotSchema = z.object({ weekday: z.number().int().min(0).max(6), type: z.enum(MEAL_TYPES) });

const generateSchema = z.object({
  week: weekKey.optional(),
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
  // "week": a whole proposal (counts as one generation). "reroll": « autre
  // idée » for exactly one slot.
  kind: z.enum(["week", "reroll"]).default("week"),
});

mealsRouter.get("/quota", async (req, res) => {
  res.json({ quota: await getMealQuota(req.userId!) });
});

// Asks Claude for a proposal. Nothing is written: the app previews it and
// saves the accepted meals through POST /meals/bulk.
mealsRouter.post("/generate", async (req, res) => {
  if (!isMealAiConfigured()) return res.status(503).json({ error: "La génération de menus n'est pas configurée sur le serveur." });
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const { slots, preferences, exclude, kind } = parsed.data;
  const week = parsed.data.week ?? currentWeek();
  if (kind === "reroll" && slots.length !== 1) return res.status(400).json({ error: "« Autre idée » change un seul repas à la fois." });

  const quota = await getMealQuota(req.userId!);
  const problem = quotaProblem(quota, kind);
  if (problem) return res.status(403).json({ error: problem, code: "quota_exceeded", quota });

  const [recipes, storedMembers, user, meals] = await Promise.all([
    prisma.recipe.findMany({ where: { userId: req.userId }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    // No name selected: members reach Claude as « Adulte 1 », « Enfant 2 »…
    prisma.familyMember.findMany({
      where: { userId: req.userId },
      select: { age: true, favoriteFoods: true, dislikedFoods: true, appetite: true, canteenDays: true, foodNotes: true, diets: true, allergies: true, foodsToLimit: true },
      orderBy: { order: "asc" },
    }),
    prisma.user.findUnique({ where: { id: req.userId }, select: { foodHealthConsentAt: true } }),
    prisma.meal.findMany({
      where: { userId: req.userId, week: { gte: addDays(week, -7 * NEIGHBOUR_WEEKS), lte: addDays(week, 7 * NEIGHBOUR_WEEKS) } },
      include: { recipe: { select: { title: true } } },
    }),
  ]);
  const requested = new Set(slots.map((s) => `${s.weekday}|${s.type}`));
  const keptMeals = meals
    .filter((m) => m.week === week && !requested.has(`${m.weekday}|${m.type}`))
    .map((m) => ({ weekday: m.weekday, type: m.type, title: m.recipe?.title ?? m.title }))
    .filter((m) => m.title);

  try {
    const members = anonymizeMembers(storedMembers, !!user?.foodHealthConsentAt);
    // Pas les mêmes plats d'une semaine à l'autre : ceux des semaines voisines sont à éviter.
    const recent = meals
      .filter((m) => m.week !== week)
      .map((m) => m.recipe?.title ?? m.title)
      .filter((t) => t.trim());
    const proposal = await proposeMeals({ slots, preferences, recipes, members, keptMeals, exclude, recent });
    // Only successful generations count against the quota.
    await prisma.mealGeneration.create({ data: { userId: req.userId!, kind } });
    res.json({ meals: proposal, quota: await getMealQuota(req.userId!) });
  } catch (e) {
    if (e instanceof MealPlannerError) return res.status(502).json({ error: e.message });
    throw e;
  }
});

const bulkSchema = z.object({ week: weekKey.optional(), meals: z.array(mealSchema).min(1).max(28) });

// Saves an accepted proposal in one go (same upsert-per-slot rule as POST /).
mealsRouter.post("/bulk", async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const items = parsed.data.meals.map((m) => ({ ...m, week: m.week ?? parsed.data.week ?? currentWeek() }));

  const recipeIds = [...new Set(items.map((m) => m.recipeId).filter((id): id is string => !!id))];
  if (recipeIds.length) {
    const owned = await prisma.recipe.count({ where: { id: { in: recipeIds }, userId: req.userId } });
    if (owned !== recipeIds.length) return res.status(400).json({ error: "Cette recette n'existe plus. Elle a peut-être été supprimée." });
  }

  const saved = await prisma.$transaction(
    items.map((d) =>
      prisma.meal.upsert({
        where: { userId_week_weekday_type: { userId: req.userId!, week: d.week, weekday: d.weekday, type: d.type } },
        update: { title: d.title, recipeId: d.recipeId ?? null, notes: d.notes, ingredients: d.ingredients ?? [] },
        create: { userId: req.userId!, week: d.week, weekday: d.weekday, type: d.type, title: d.title, recipeId: d.recipeId ?? null, notes: d.notes, ingredients: d.ingredients ?? [] },
      }),
    ),
  );
  res.status(201).json({ meals: saved.map(serializeMeal) });
});
