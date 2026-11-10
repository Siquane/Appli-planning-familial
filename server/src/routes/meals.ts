import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import type { Meal } from "@prisma/client";

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
