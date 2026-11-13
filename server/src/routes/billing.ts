import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "../db";
import { env, isBillingConfigured } from "../env";
import { requireAuth } from "../middleware/auth";
import { BillingError, syncUserPacks } from "../lib/revenuecat";

// In-app purchases (RevenueCat). The app identifies the RevenueCat customer
// with our user id, so `app_user_id` in webhooks is a User.id.

export const billingRouter = Router();

// Called by the app right after a purchase or « Restaurer mes achats », so
// the pack is active without waiting for the webhook.
billingRouter.post("/sync", requireAuth, async (req, res) => {
  if (!isBillingConfigured()) return res.status(503).json({ error: "Les achats ne sont pas configurés sur le serveur." });
  try {
    const user = await syncUserPacks(req.userId!);
    res.json({ budgetUntil: user.budgetUntil?.toISOString() ?? null, mealsUntil: user.mealsUntil?.toISOString() ?? null });
  } catch (e) {
    if (e instanceof BillingError) return res.status(502).json({ error: "Impossible de vérifier l'achat pour le moment. Réessaie dans un instant." });
    throw e;
  }
});

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// RevenueCat webhook: any event (purchase, renewal, cancellation, expiration,
// refund, transfer…) triggers a fresh read of the customer's entitlements.
billingRouter.post("/revenuecat", async (req, res) => {
  if (!env.revenuecat.webhookAuth || !sameSecret(req.headers.authorization ?? "", env.revenuecat.webhookAuth)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isBillingConfigured()) return res.status(503).json({ error: "Billing not configured" });

  const event = (req.body?.event ?? {}) as { app_user_id?: string; transferred_from?: string[]; transferred_to?: string[] };
  const ids = [event.app_user_id, ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter((id): id is string => !!id);
  // Anonymous RevenueCat ids ($RCAnonymousID:…) aren't users of ours.
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  try {
    for (const u of users) await syncUserPacks(u.id);
  } catch (e) {
    // A non-2xx makes RevenueCat retry the webhook later.
    if (e instanceof BillingError) return res.status(502).json({ error: e.message });
    throw e;
  }
  res.json({ ok: true, synced: users.length });
});
