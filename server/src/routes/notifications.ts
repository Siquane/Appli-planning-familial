import { Router } from "express";
import { prisma } from "../db";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

function groupFor(createdAt: Date): "today" | "week" {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return createdAt >= startOfToday ? "today" : "week";
}

notificationsRouter.get("/", async (req, res) => {
  const notifications = await prisma.notification.findMany({ where: { userId: req.userId }, orderBy: { createdAt: "desc" } });
  res.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      unread: n.unread,
      createdAt: n.createdAt.toISOString(),
      group: groupFor(n.createdAt),
    })),
  });
});

notificationsRouter.post("/:id/read", async (req, res) => {
  const existing = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) return res.status(404).json({ error: "Introuvable : ça a peut-être été supprimé entre-temps. Actualise l'écran." });
  await prisma.notification.update({ where: { id: existing.id }, data: { unread: false } });
  res.status(204).end();
});

notificationsRouter.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.userId, unread: true }, data: { unread: false } });
  res.status(204).end();
});

// Téléphone de ce compte, pour les alertes de la famille (lib/familyAlerts.ts).
const pushTokenSchema = z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]{1,200}\]$/) });

notificationsRouter.put("/push-token", async (req, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Les notifications de ce téléphone n'ont pas pu être activées. Réessaie." });
  // Un téléphone passé à un autre compte change de propriétaire.
  await prisma.pushToken.upsert({
    where: { token: parsed.data.token },
    create: { token: parsed.data.token, userId: req.accountId! },
    update: { userId: req.accountId! },
  });
  res.status(204).end();
});

notificationsRouter.get("/family-alerts", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.accountId }, select: { familyAlerts: true } });
  res.json({ enabled: user?.familyAlerts ?? true });
});

notificationsRouter.put("/family-alerts", async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  await prisma.user.update({ where: { id: req.accountId }, data: { familyAlerts: parsed.data.enabled } });
  res.json({ enabled: parsed.data.enabled });
});
