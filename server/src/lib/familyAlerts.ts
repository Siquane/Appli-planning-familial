import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";

/**
 * Alertes « quelqu'un a modifié le planning » envoyées sur les téléphones des
 * AUTRES comptes de la famille. Les changements d'une même personne sont
 * regroupés pendant ALERT_DELAY_MS (enregistrer une tâche sur 3 jours, ou
 * vider la file hors connexion, = une seule notification).
 */
export type ChangeKind = "planning" | "menu" | "courses" | "recettes";

const LABELS: Record<ChangeKind, string> = {
  planning: "le planning",
  menu: "le menu de la semaine",
  courses: "la liste de courses",
  recettes: "les recettes",
};

// Écran ouvert par un appui sur la notification.
const ROUTES: Record<ChangeKind, string> = {
  planning: "/home",
  menu: "/repas?tab=menu",
  courses: "/repas?tab=courses",
  recettes: "/repas?tab=recettes",
};

const ORDER: ChangeKind[] = ["planning", "menu", "courses", "recettes"];

export const ALERT_DELAY_MS = Number(process.env.FAMILY_ALERT_DELAY_MS ?? 90_000);
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface Pending {
  familyId: string;
  actorId: string;
  kinds: Set<ChangeKind>;
  timer: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<string, Pending>();

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string };
  channelId: string;
  sound: "default";
}

type Sender = (messages: PushMessage[]) => Promise<void>;
let sender: Sender = sendWithExpo;

/** Tests : remplace l'envoi réel vers Expo. */
export function setPushSender(next: Sender | null) {
  sender = next ?? sendWithExpo;
}

/** « Anaïs a modifié le planning et la liste de courses. » */
export function alertBody(actorName: string, kinds: ChangeKind[]): string {
  const labels = ORDER.filter((k) => kinds.includes(k)).map((k) => LABELS[k]);
  const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}` : labels[0];
  return `${actorName || "Quelqu'un"} a modifié ${list}.`;
}

export function recordChange(familyId: string, actorId: string, kind: ChangeKind) {
  const key = `${familyId}:${actorId}`;
  let entry = pending.get(key);
  if (!entry) {
    entry = { familyId, actorId, kinds: new Set(), timer: null };
    pending.set(key, entry);
  }
  entry.kinds.add(kind);
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    flushKey(key).catch((e) => console.error("Family alert failed:", e));
  }, ALERT_DELAY_MS);
  entry.timer.unref?.();
}

/** Envoie tout ce qui attend (tests, arrêt du serveur). */
export async function flushFamilyAlerts() {
  await Promise.all([...pending.keys()].map(flushKey));
}

async function flushKey(key: string) {
  const entry = pending.get(key);
  if (!entry) return;
  pending.delete(key);
  if (entry.timer) clearTimeout(entry.timer);

  const [actor, recipients] = await Promise.all([
    prisma.user.findUnique({ where: { id: entry.actorId }, select: { name: true } }),
    prisma.user.findMany({
      where: { OR: [{ id: entry.familyId }, { familyOwnerId: entry.familyId }], NOT: { id: entry.actorId }, familyAlerts: true },
      select: { pushTokens: { select: { token: true } } },
    }),
  ]);
  const tokens = recipients.flatMap((r) => r.pushTokens.map((t) => t.token));
  if (tokens.length === 0) return;

  const kinds = [...entry.kinds];
  const first = ORDER.find((k) => entry.kinds.has(k))!;
  const body = alertBody(actor?.name ?? "", kinds);
  await sender(tokens.map((to) => ({ to, title: "Passerelle", body, data: { url: ROUTES[first] }, channelId: "family", sound: "default" })));
}

async function sendWithExpo(messages: PushMessage[]) {
  // Expo accepte 100 messages par requête.
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push ${res.status}`);
    const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    // Téléphone désinstallé ou jeton périmé : on l'oublie.
    const gone = (json.data ?? []).flatMap((ticket, j) => (ticket.details?.error === "DeviceNotRegistered" ? [batch[j].to] : []));
    if (gone.length) await prisma.pushToken.deleteMany({ where: { token: { in: gone } } });
  }
}

/**
 * Middleware posé devant les routeurs partagés : après une écriture réussie,
 * note le changement pour la famille. Rien n'est envoyé à celui qui modifie.
 */
export function familyActivity(kind: ChangeKind, readOnlyPaths: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Routes en POST qui n'enregistrent rien (proposition, lecture d'un lien…).
    if (req.method !== "GET" && !readOnlyPaths.includes(req.path)) {
      res.on("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300 && req.familyId && req.accountId) {
          recordChange(req.familyId, req.accountId, kind);
        }
      });
    }
    next();
  };
}
