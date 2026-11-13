import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { FREE_DOCUMENT_LIMIT, getMealQuota, hasAnyPack, hasPack } from "../lib/plan";

// What the account can do: which packs are active and the free quotas in use.
export const planRouter = Router();
planRouter.use(requireAuth);

planRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { budgetUntil: true, mealsUntil: true } });
  const [meals, documentCount] = await Promise.all([getMealQuota(userId), prisma.document.count({ where: { userId } })]);
  const budget = hasPack(user, "budget");
  const menus = hasPack(user, "meals");
  res.json({
    packs: {
      budget: { active: budget, until: budget ? user.budgetUntil!.toISOString() : null },
      meals: { active: menus, until: menus ? user.mealsUntil!.toISOString() : null },
    },
    meals,
    documents: { used: documentCount, limit: hasAnyPack(user) ? null : FREE_DOCUMENT_LIMIT },
  });
});
