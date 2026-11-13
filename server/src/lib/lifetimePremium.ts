import { prisma } from "../db";
import { env } from "../env";

// Accounts that get both Premium packs for free, forever (the family's own
// accounts). Listed in LIFETIME_PREMIUM_EMAILS on the server, comma-separated,
// so no address is written in the code. Applied at startup, and kept when
// RevenueCat syncs (it would otherwise clear packs it doesn't sell them).

export const LIFETIME_UNTIL = new Date("2999-12-31T23:59:59Z");

export function lifetimeEmails(raw = env.lifetimePremiumEmails): string[] {
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isLifetimeEmail(email: string, list = lifetimeEmails()) {
  return list.includes(email.trim().toLowerCase());
}

/** Gives both packs, with no end, to every listed account. Returns how many were updated. */
export async function grantLifetimePremium(list = lifetimeEmails()) {
  if (list.length === 0) return 0;
  const { count } = await prisma.user.updateMany({
    where: { email: { in: list, mode: "insensitive" } },
    data: { budgetUntil: LIFETIME_UNTIL, mealsUntil: LIFETIME_UNTIL },
  });
  return count;
}
