import { prisma } from "../db";
import { env } from "../env";
import { isLifetimeEmail, LIFETIME_UNTIL } from "./lifetimePremium";

// RevenueCat is the source of truth for store subscriptions. Its entitlement
// identifiers match our packs: "budget" and "meals" (the « Les 2 » products
// grant both). After a purchase, and on every webhook, we read the customer's
// entitlements and copy their expiry dates onto the user.

export const ENTITLEMENTS = { budget: "budgetUntil", meals: "mealsUntil" } as const;
/** A lifetime entitlement has no expiry date. */
const LIFETIME = new Date("2999-12-31T23:59:59Z");

type Entitlement = { expires_date: string | null };
type SubscriberResponse = { subscriber?: { entitlements?: Record<string, Entitlement> } };

export class BillingError extends Error {}

/** Entitlement expiry dates by pack, null when RevenueCat doesn't grant it. */
export async function fetchPackDates(appUserId: string): Promise<{ budgetUntil: Date | null; mealsUntil: Date | null }> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${env.revenuecat.secretKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new BillingError(`RevenueCat a répondu ${res.status}`);
  const body = (await res.json()) as SubscriberResponse;
  const entitlements = body.subscriber?.entitlements ?? {};
  const dateOf = (id: string) => {
    const e = entitlements[id];
    if (!e) return null;
    return e.expires_date ? new Date(e.expires_date) : LIFETIME;
  };
  return { budgetUntil: dateOf("budget"), mealsUntil: dateOf("meals") };
}

/**
 * Copies RevenueCat's view onto the user. Once a user is synced, RevenueCat
 * wins: a pack it doesn't grant is cleared (expired, refunded…), including a
 * date set by hand with `npm run premium` — except for lifetime accounts
 * (LIFETIME_PREMIUM_EMAILS), which always keep both packs.
 */
export async function syncUserPacks(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const dates = isLifetimeEmail(user.email)
    ? { budgetUntil: LIFETIME_UNTIL, mealsUntil: LIFETIME_UNTIL }
    : await fetchPackDates(userId);
  return prisma.user.update({ where: { id: userId }, data: dates, select: { budgetUntil: true, mealsUntil: true } });
}
