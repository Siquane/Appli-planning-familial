import { prisma } from "../../db";
import { sendPush } from "../familyAlerts";

// Notifications envoyées par le serveur sur le téléphone de l'ENFANT
// (appli Cervelle, jeton Expo enregistré sur son LearnerDevice).
// Les rappels datés (interro J-3, veille, « À revoir ») sont programmés par
// le téléphone lui-même : seul « fiches prêtes » vient d'ici, parce que la
// préparation se termine pendant que l'appli peut être fermée.

/** Canal Android créé par l'appli Cervelle (src/lib/notifications.ts). */
export const CERVELLE_CHANNEL = "revisions";

export function readyBody(title: string): string {
  const t = title.trim();
  return t ? `Tes fiches sur « ${t} » sont prêtes. On révise ?` : "Tes fiches sont prêtes. On révise ?";
}

/** « Tes fiches sur … sont prêtes » sur les téléphones de l'enfant. Ne lève jamais d'erreur. */
export async function notifyRevisionReady(revisionId: string): Promise<void> {
  try {
    const revision = await prisma.revision.findUnique({ where: { id: revisionId }, select: { id: true, title: true, learnerId: true, status: true } });
    if (!revision || revision.status !== "ready") return;
    const devices = await prisma.learnerDevice.findMany({
      where: { learnerId: revision.learnerId, readyAlert: true, pushToken: { not: null } },
      select: { pushToken: true },
    });
    await sendPush(
      devices.map((d) => ({
        to: d.pushToken!,
        title: "Cervelle",
        body: readyBody(revision.title),
        data: { url: `/revision/${revision.id}` },
        channelId: CERVELLE_CHANNEL,
        sound: "default" as const,
      })),
    );
  } catch (e) {
    console.error("Cervelle: ready notification failed", e);
  }
}
