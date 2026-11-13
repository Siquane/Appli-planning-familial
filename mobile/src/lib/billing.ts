import { Platform } from "react-native";
import Purchases, { type PurchasesPackage } from "react-native-purchases";
import { api } from "../api/client";

// In-app subscriptions through RevenueCat (Google Play for now, App Store
// later: add EXPO_PUBLIC_REVENUECAT_IOS_KEY and the same offerings).
//
// RevenueCat setup this code expects:
//   - entitlements "budget" and "meals"
//   - offerings "budget", "meals" and "both", each with a Monthly and an
//     Annual package; the "both" products grant both entitlements.
// The customer is identified by our user id, so the server can match
// RevenueCat webhooks to accounts.

const API_KEY =
  Platform.OS === "android" ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY : Platform.OS === "ios" ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : undefined;

export const PACK_OFFERINGS = ["budget", "meals", "both"] as const;
export type PackOffering = (typeof PACK_OFFERINGS)[number];

export interface PackPrices {
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

/** False until a RevenueCat key is set for this platform (the Premium screen then says « bientôt »). */
export function isBillingAvailable() {
  return !!API_KEY;
}

let configuredFor: string | null = null;

async function ensureConfigured(userId: string) {
  if (!API_KEY) throw new Error("Les achats ne sont pas encore disponibles sur cet appareil.");
  if (configuredFor === userId) return;
  if (configuredFor === null) {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
  } else {
    await Purchases.logIn(userId);
  }
  configuredFor = userId;
}

/** Store packages (with localized prices) for each pack, keyed by offering. */
export async function loadPackPrices(userId: string): Promise<Partial<Record<PackOffering, PackPrices>>> {
  await ensureConfigured(userId);
  const offerings = await Purchases.getOfferings();
  const out: Partial<Record<PackOffering, PackPrices>> = {};
  for (const id of PACK_OFFERINGS) {
    const o = offerings.all[id];
    if (o) out[id] = { monthly: o.monthly, annual: o.annual };
  }
  return out;
}

/** Asks the server to read the new entitlements right away (the webhook may lag). */
async function syncWithServer() {
  await api.post("/billing/sync");
}

function isCancelled(e: unknown) {
  const err = e as { userCancelled?: boolean | null; code?: string };
  return !!err?.userCancelled || err?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

const productId = (id: string) => id.split(":")[0];

/**
 * The Google Play subscription this purchase should replace, if any: moving
 * to « Les 2 », or changing period (monthly <-> annual) within the same pack.
 * Buying the other single pack is an addition, not a replacement.
 */
export function replacedProduct(
  target: PackOffering,
  targetProduct: string,
  activeSubscriptions: string[],
  prices: Partial<Record<PackOffering, PackPrices>>,
): string | null {
  const offeringOf = (product: string) =>
    PACK_OFFERINGS.find((o) => [prices[o]?.monthly, prices[o]?.annual].some((p) => p && productId(p.product.identifier) === product));
  for (const sub of activeSubscriptions.map(productId)) {
    if (sub === productId(targetProduct)) continue;
    const from = offeringOf(sub);
    if (target === "both" || from === target) return sub;
  }
  return null;
}

/** Runs the store purchase sheet. Resolves false if the user backed out. */
export async function buyPackage(
  userId: string,
  pkg: PurchasesPackage,
  offering: PackOffering,
  prices: Partial<Record<PackOffering, PackPrices>>,
): Promise<boolean> {
  await ensureConfigured(userId);
  try {
    let change = null;
    if (Platform.OS === "android") {
      const info = await Purchases.getCustomerInfo();
      const old = replacedProduct(offering, pkg.product.identifier, info.activeSubscriptions, prices);
      // Google Play swaps the subscription and credits what's left of the old one.
      if (old) change = { oldProductIdentifier: old };
    }
    await Purchases.purchasePackage(pkg, null, change);
  } catch (e) {
    if (isCancelled(e)) return false;
    throw new Error("L'achat n'a pas abouti. Aucun montant n'a été prélevé.");
  }
  await syncWithServer();
  return true;
}

/** « Restaurer mes achats » (new phone, reinstall). */
export async function restorePurchases(userId: string) {
  await ensureConfigured(userId);
  await Purchases.restorePurchases();
  await syncWithServer();
}

/** Called when the user signs out, so the next account doesn't inherit the store customer. */
export async function resetBilling() {
  if (configuredFor === null) return;
  configuredFor = null;
  try {
    await Purchases.logOut();
  } catch {
    // Already anonymous: nothing to do.
  }
}

/** Where Google Play / the App Store let people cancel or change a subscription. */
export const MANAGE_SUBSCRIPTIONS_URL =
  Platform.OS === "ios" ? "https://apps.apple.com/account/subscriptions" : "https://play.google.com/store/account/subscriptions";
