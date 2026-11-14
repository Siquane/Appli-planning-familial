import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { BUDGET_TRIAL_DAYS, FREE_DOCUMENT_LIMIT, budgetTrialEnd, getMealQuota, hasAnyPack, hasPack, hasPaidPack } from "../lib/plan";

// What the account can do: which packs are active and the free quotas in use.
export const planRouter = Router();
planRouter.use(requireAuth);

async function planOf(userId: string, privateId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { budgetUntil: true, mealsUntil: true, budgetTrialStartedAt: true } });
  const [meals, documentCount] = await Promise.all([getMealQuota(userId), prisma.document.count({ where: { userId: privateId } })]);
  const now = new Date();
  const budget = hasPack(user, "budget", now);
  const menus = hasPack(user, "meals", now);
  const budgetPaid = hasPaidPack(user, "budget", now);
  const trialEnd = budgetTrialEnd(user);
  const trialRunning = !!trialEnd && trialEnd > now && !budgetPaid;
  return {
    packs: {
      budget: {
        active: budget,
        // The paid date when there is one, otherwise the end of the trial.
        until: budgetPaid ? user.budgetUntil!.toISOString() : budget && trialEnd ? trialEnd.toISOString() : null,
        trial: {
          /** Never started, and no paid pack that would make it pointless. */
          available: !user.budgetTrialStartedAt && !budgetPaid,
          active: trialRunning,
          days: BUDGET_TRIAL_DAYS,
          endsAt: trialEnd ? trialEnd.toISOString() : null,
        },
      },
      meals: { active: menus, until: menus ? user.mealsUntil!.toISOString() : null },
    },
    meals,
    documents: { used: documentCount, limit: hasAnyPack(user, now) ? null : FREE_DOCUMENT_LIMIT },
  };
}

planRouter.get("/", async (req, res) => {
  res.json(await planOf(req.userId!, req.privateId!));
});

// Starts the Budget+ trial. Once per account: asking again, or while a paid
// pack is running, is refused.
planRouter.post("/trial/budget", async (req, res) => {
  const userId = req.userId!;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { budgetUntil: true, mealsUntil: true, budgetTrialStartedAt: true } });
  if (hasPaidPack(user, "budget")) return res.status(409).json({ error: "Tu as déjà Budget+." });
  if (user.budgetTrialStartedAt) return res.status(409).json({ error: "L'essai gratuit de Budget+ a déjà été utilisé." });
  // updateMany with the condition: two taps at once start it only once.
  const { count } = await prisma.user.updateMany({ where: { id: userId, budgetTrialStartedAt: null }, data: { budgetTrialStartedAt: new Date() } });
  if (count === 0) return res.status(409).json({ error: "L'essai gratuit de Budget+ a déjà été utilisé." });
  res.status(201).json(await planOf(userId, req.privateId!));
});
