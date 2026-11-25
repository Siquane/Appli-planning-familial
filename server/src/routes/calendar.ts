import { Router } from "express";
import crypto from "node:crypto";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { verifyAccessToken } from "../lib/jwt";
import { familyIdOf } from "../lib/family";
import { seal } from "../lib/secretBox";
import { env, isGoogleConfigured, isMicrosoftConfigured } from "../env";
import { exchangeGoogleCode, getGoogleAuthUrl } from "../services/googleCalendar";
import { exchangeMicrosoftCode, getMicrosoftAuthUrl } from "../services/outlookCalendar";

export const calendarRouter = Router();

// Connexion d'un agenda : le navigateur ne peut pas porter d'en-tête
// Authorization. L'appli demande donc un ticket (POST /:provider/ticket, 2 min,
// usage unique), l'ouvre dans le navigateur, puis le serveur garde un « état »
// OAuth de 10 min en base jusqu'au retour de Google ou Microsoft.
// (?token= reste accepté pour les versions de l'appli qui n'ont pas le ticket.)
const TICKET_TTL_MS = 2 * 60_000;
const STATE_TTL_MS = 10 * 60_000;
const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

async function issue(kind: "ticket" | "state", userId: string, ttlMs: number): Promise<string> {
  await prisma.oAuthTicket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const value = crypto.randomBytes(24).toString("hex");
  await prisma.oAuthTicket.create({ data: { kind, tokenHash: hash(value), userId, expiresAt: new Date(Date.now() + ttlMs) } });
  return value;
}

/** La famille liée à ce ticket ou état (consommé), ou null. */
async function consume(kind: "ticket" | "state", value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const row = await prisma.oAuthTicket.findUnique({ where: { tokenHash: hash(value) } });
  if (!row) return null;
  const { count } = await prisma.oAuthTicket.deleteMany({ where: { id: row.id } });
  if (count === 0 || row.kind !== kind || row.expiresAt < new Date()) return null;
  return row.userId;
}

/** La famille qui ouvre la connexion : par ticket, ou par l'ancien ?token=. */
async function starter(query: Record<string, unknown>): Promise<string | null> {
  if (typeof query.ticket === "string") return consume("ticket", query.ticket);
  try {
    return await familyIdOf(verifyAccessToken(String(query.token ?? "")).sub);
  } catch {
    return null;
  }
}

calendarRouter.post("/:provider/ticket", requireAuth, async (req, res) => {
  if (req.params.provider !== "google" && req.params.provider !== "microsoft") return res.status(404).json({ error: "Agenda inconnu" });
  // The agenda connection belongs to the family, not to the one account that started it.
  res.json({ ticket: await issue("ticket", req.userId!, TICKET_TTL_MS) });
});

calendarRouter.get("/status", requireAuth, async (req, res) => {
  const connections = await prisma.calendarConnection.findMany({ where: { userId: req.userId } });
  res.json({
    connections: connections.map((c) => ({ provider: c.provider, email: c.email })),
    googleConfigured: isGoogleConfigured(),
    microsoftConfigured: isMicrosoftConfigured(),
  });
});

calendarRouter.delete("/:provider", requireAuth, async (req, res) => {
  await prisma.calendarConnection.deleteMany({ where: { userId: req.userId, provider: String(req.params.provider) } });
  await prisma.task.updateMany({ where: { userId: req.userId, externalProvider: String(req.params.provider) }, data: { synced: false, externalEventId: null, externalProvider: null } });
  res.status(204).end();
});

// Apple sync has no server-side OAuth: the mobile app writes directly to the
// device calendar via expo-calendar. This just records the connection so
// GET /calendar/status reflects it consistently across the three providers.
calendarRouter.post("/apple/connect", requireAuth, async (req, res) => {
  const connection = await prisma.calendarConnection.upsert({
    where: { userId_provider: { userId: req.userId!, provider: "apple" } },
    update: {},
    create: { userId: req.userId!, provider: "apple" },
  });
  res.json({ connection: { provider: connection.provider } });
});

function requireProviderConfigured(configured: boolean, name: string) {
  return (req: any, res: any, next: any) => {
    if (!configured) return res.status(503).json({ error: `${name} n'est pas configuré côté serveur (variables d'environnement manquantes).` });
    next();
  };
}

calendarRouter.get("/google/start", requireProviderConfigured(isGoogleConfigured(), "Google Calendar"), async (req, res) => {
  const userId = await starter(req.query);
  if (!userId) return res.status(401).send("Lien expiré. Recommence depuis l'appli.");
  res.redirect(getGoogleAuthUrl(await issue("state", userId, STATE_TTL_MS)));
});

calendarRouter.get("/google/callback", async (req, res) => {
  const userId = await consume("state", typeof req.query.state === "string" ? req.query.state : undefined);
  if (!userId) return res.status(400).send("État invalide ou expiré");
  try {
    const { accessToken, refreshToken, expiresAt, email } = await exchangeGoogleCode(String(req.query.code));
    await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId, provider: "google" } },
      update: { accessToken: seal(accessToken), refreshToken: seal(refreshToken), expiresAt, email },
      create: { userId, provider: "google", accessToken: seal(accessToken), refreshToken: seal(refreshToken), expiresAt, email },
    });
    res.redirect(`${env.appDeepLink}?provider=google&status=connected`);
  } catch (e) {
    console.error("Google OAuth callback failed:", e);
    res.redirect(`${env.appDeepLink}?provider=google&status=error`);
  }
});

calendarRouter.get("/microsoft/start", requireProviderConfigured(isMicrosoftConfigured(), "Outlook"), async (req, res) => {
  const userId = await starter(req.query);
  if (!userId) return res.status(401).send("Lien expiré. Recommence depuis l'appli.");
  res.redirect(await getMicrosoftAuthUrl(await issue("state", userId, STATE_TTL_MS)));
});

calendarRouter.get("/microsoft/callback", async (req, res) => {
  const userId = await consume("state", typeof req.query.state === "string" ? req.query.state : undefined);
  if (!userId) return res.status(400).send("État invalide ou expiré");
  try {
    const { accessToken, refreshToken, expiresAt, email } = await exchangeMicrosoftCode(String(req.query.code));
    await prisma.calendarConnection.upsert({
      where: { userId_provider: { userId, provider: "outlook" } },
      update: { accessToken: seal(accessToken), refreshToken: seal(refreshToken), expiresAt, email },
      create: { userId, provider: "outlook", accessToken: seal(accessToken), refreshToken: seal(refreshToken), expiresAt, email },
    });
    res.redirect(`${env.appDeepLink}?provider=outlook&status=connected`);
  } catch (e) {
    console.error("Microsoft OAuth callback failed:", e);
    res.redirect(`${env.appDeepLink}?provider=outlook&status=error`);
  }
});
