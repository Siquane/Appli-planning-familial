import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { deleteChildAccount } from "../lib/childAccess";
import { requireAuth } from "../middleware/auth";
import { patchSchema } from "../lib/validation";

export const membersRouter = Router();
membersRouter.use(requireAuth);

membersRouter.get("/", async (req, res) => {
  const members = await prisma.familyMember.findMany({ where: { userId: req.userId }, orderBy: { order: "asc" } });
  res.json({ members });
});

export const MEMBER_DIETS = ["végétarien", "vegan", "sans-porc", "halal", "casher", "sans-gluten", "sans-lactose"] as const;
const text = z.string().trim().max(500);

const memberSchema = z.object({
  name: z.string().min(1),
  initials: z.string().min(1).max(3).optional(),
  tint: z.enum(["accent", "neutral", "accent2"]).default("neutral"),
  age: z.number().int().min(0).max(120).nullable().optional(),
  birthday: z.coerce.date().nullable().optional(),
  // Food preferences (menus générés).
  favoriteFoods: text.optional(),
  dislikedFoods: text.optional(),
  appetite: z.enum(["petit", "moyen", "gros"]).nullable().optional(),
  canteenDays: z.array(z.number().int().min(0).max(4)).max(5).optional(),
  foodNotes: text.optional(),
  // Sensitive: refused unless the account has consented (see /food-consent).
  diets: z.array(z.enum(MEMBER_DIETS)).max(MEMBER_DIETS.length).optional(),
  allergies: text.optional(),
  foodsToLimit: text.optional(),
});

const SENSITIVE_FIELDS = ["diets", "allergies", "foodsToLimit"] as const;
const SENSITIVE_CLEARED = { diets: [] as string[], allergies: "", foodsToLimit: "" };

async function hasFoodConsent(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { foodHealthConsentAt: true } });
  return !!user?.foodHealthConsentAt;
}

/** True when the payload tries to store a non-empty sensitive value. */
function writesSensitive(data: Partial<Record<(typeof SENSITIVE_FIELDS)[number], unknown>>) {
  return SENSITIVE_FIELDS.some((f) => {
    const v = data[f];
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.length > 0;
  });
}

const CONSENT_REQUIRED = "Le régime, les allergies et les aliments à limiter demandent ton accord (Famille → fiche d'un membre → Repas).";

// Explicit, account-wide consent to store health-related food data (RGPD art. 9).
membersRouter.get("/food-consent", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { foodHealthConsentAt: true } });
  res.json({ consentedAt: user?.foodHealthConsentAt?.toISOString() ?? null });
});

membersRouter.post("/food-consent", async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.userId }, data: { foodHealthConsentAt: new Date() }, select: { foodHealthConsentAt: true } });
  res.json({ consentedAt: user.foodHealthConsentAt!.toISOString() });
});

// Withdrawing consent erases the sensitive fields of every member right away.
membersRouter.delete("/food-consent", async (req, res) => {
  await prisma.$transaction([
    prisma.familyMember.updateMany({ where: { userId: req.userId }, data: SENSITIVE_CLEARED }),
    prisma.user.update({ where: { id: req.userId }, data: { foodHealthConsentAt: null } }),
  ]);
  res.status(204).end();
});

membersRouter.post("/", async (req, res) => {
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  if (writesSensitive(parsed.data) && !(await hasFoodConsent(req.userId!))) return res.status(403).json({ error: CONSENT_REQUIRED });
  const count = await prisma.familyMember.count({ where: { userId: req.userId } });
  const member = await prisma.familyMember.create({
    data: {
      userId: req.userId!,
      name: parsed.data.name,
      initials: parsed.data.initials ?? parsed.data.name.slice(0, 2).toUpperCase(),
      tint: parsed.data.tint,
      age: parsed.data.age ?? null,
      birthday: parsed.data.birthday ?? null,
      favoriteFoods: parsed.data.favoriteFoods,
      dislikedFoods: parsed.data.dislikedFoods,
      appetite: parsed.data.appetite ?? null,
      canteenDays: parsed.data.canteenDays,
      foodNotes: parsed.data.foodNotes,
      diets: parsed.data.diets,
      allergies: parsed.data.allergies,
      foodsToLimit: parsed.data.foodsToLimit,
      order: count,
    },
  });
  res.status(201).json({ member });
});

membersRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema(memberSchema).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  if (writesSensitive(parsed.data) && !(await hasFoodConsent(req.userId!))) return res.status(403).json({ error: CONSENT_REQUIRED });
  const existing = await prisma.familyMember.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  const member = await prisma.familyMember.update({ where: { id: existing.id }, data: parsed.data });
  res.json({ member });
});

membersRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.familyMember.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  // Son accès enfant (et ses documents) part avec lui.
  const child = await prisma.user.findUnique({ where: { childMemberId: existing.id }, select: { id: true } });
  if (child) await deleteChildAccount(child.id);
  await prisma.familyMember.delete({ where: { id: existing.id } });
  res.status(204).end();
});
