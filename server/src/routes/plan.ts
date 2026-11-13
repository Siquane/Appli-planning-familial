import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { FREE_DOCUMENT_LIMIT, getMealQuota, isPremium } from "../lib/plan";

// What the account can do: Premium status and the free quotas in use.
export const planRouter = Router();
planRouter.use(requireAuth);

planRouter.get("/", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { premiumUntil: true } });
  const premium = isPremium(user);
  const [meals, documentCount] = await Promise.all([getMealQuota(userId), prisma.document.count({ where: { userId } })]);
  res.json({
    premium,
    premiumUntil: premium ? user.premiumUntil!.toISOString() : null,
    meals,
    documents: { used: documentCount, limit: premium ? null : FREE_DOCUMENT_LIMIT },
  });
});
