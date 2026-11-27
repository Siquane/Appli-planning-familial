import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { removeObjects } from "../lib/storage";
import type { Recipe } from "@prisma/client";
import { patchSchema } from "../lib/validation";
import { ImportError, importRecipeFromUrl } from "../lib/recipeImport";

export const recipesRouter = Router();
recipesRouter.use(requireAuth);

type RecipeWithMembers = Recipe & { members: { memberId: string }[] };

function serializeRecipe(recipe: RecipeWithMembers) {
  return {
    id: recipe.id,
    title: recipe.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    notes: recipe.notes,
    memberIds: recipe.members.map((m) => m.memberId),
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  };
}

const include = { members: { select: { memberId: true } } } as const;

recipesRouter.get("/", async (req, res) => {
  const recipes = await prisma.recipe.findMany({ where: { userId: req.userId }, include, orderBy: { createdAt: "desc" } });
  res.json({ recipes: recipes.map(serializeRecipe) });
});

const recipeSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string().min(1)).default([]),
  steps: z.array(z.string().min(1)).default([]),
  notes: z.string().default(""),
  memberIds: z.array(z.string()).default([]),
});

async function loadOwnedRecipe(userId: string, id: string) {
  return prisma.recipe.findFirst({ where: { id, userId }, include });
}

recipesRouter.post("/", async (req, res) => {
  const parsed = recipeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const recipe = await prisma.recipe.create({
    data: {
      userId: req.userId!,
      title: d.title,
      ingredients: d.ingredients,
      steps: d.steps,
      notes: d.notes,
      members: { create: d.memberIds.map((memberId) => ({ memberId })) },
    },
    include,
  });
  res.status(201).json({ recipe: serializeRecipe(recipe) });
});

// Reads a recipe from a web page and returns it as a draft (nothing is
// saved): the app fills its form with it so the user can check and edit.
recipesRouter.post("/import", async (req, res) => {
  const parsed = z.object({ url: z.string().trim().min(1, "Adresse manquante") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  try {
    res.json({ recipe: await importRecipeFromUrl(parsed.data.url) });
  } catch (e) {
    if (e instanceof ImportError) return res.status(422).json({ error: e.message });
    throw e;
  }
});

recipesRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(recipeSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const existing = await loadOwnedRecipe(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });

  const { memberIds, ...rest } = parsed.data;
  const recipe = await prisma.recipe.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(memberIds !== undefined ? { members: { deleteMany: {}, create: memberIds.map((memberId) => ({ memberId })) } } : {}),
    },
    include,
  });
  res.json({ recipe: serializeRecipe(recipe) });
});

recipesRouter.delete("/:id", async (req, res) => {
  const existing = await loadOwnedRecipe(req.userId!, req.params.id);
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  // Attachment rows cascade with the recipe; their files must go too.
  const attachments = await prisma.document.findMany({ where: { recipeId: existing.id }, select: { fileKey: true } });
  await removeObjects(attachments.map((a) => a.fileKey));
  await prisma.recipe.delete({ where: { id: existing.id } });
  res.status(204).end();
});
