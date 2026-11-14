import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db";
import { removeObjects } from "../lib/storage";
import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from "../lib/jwt";
import { requireAuth } from "../middleware/auth";
import { sendPasswordResetCode } from "../services/mailer";
import { accountLimiter, loginLimiter } from "../middleware/rateLimits";
import { InviteError, findLiveInvite } from "../lib/family";

export const authRouter = Router();

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  name: z.string().trim().min(1),
  /** Joining an existing family with the code a parent gave. */
  familyCode: z.string().trim().max(40).optional(),
  /** Required with a family code: one can join from 15 years old (creating a family needs 18). */
  age15: z.boolean().optional(),
});

authRouter.post("/signup", accountLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" });
  const { email, password, name, familyCode, age15 } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Un compte existe déjà avec cet email" });

  let join: { ownerId: string; role: string } | null = null;
  if (familyCode) {
    if (age15 !== true) return res.status(400).json({ error: "Pour rejoindre une famille, il faut avoir 15 ans ou plus." });
    try {
      const invite = await findLiveInvite(familyCode);
      join = { ownerId: invite.ownerId, role: invite.role };
    } catch (e) {
      if (e instanceof InviteError) return res.status(400).json({ error: e.message, code: "invalid_family_code" });
      throw e;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      initials: initialsFor(name),
      constraints: { create: {} },
      ...(join ? { familyOwnerId: join.ownerId, familyRole: join.role } : {}),
    },
  });

  const tokens = await issueTokens(user.id, user.email);
  res.status(201).json({ user: publicUser(user), ...tokens });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Requête invalide" });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }
  const tokens = await issueTokens(user.id, user.email);
  res.json({ user: publicUser(user), ...tokens });
});

// --- Password reset by 6-digit e-mail code ---------------------------------

const RESET_CODE_TTL_MINUTES = 15;
const RESET_MAX_ATTEMPTS = 5;
const RESET_RESEND_COOLDOWN_MS = 60_000;

const hashResetCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

// Emails were stored as typed at signup, so match case-insensitively.
function findUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email.trim(), mode: "insensitive" } } });
}

const forgotSchema = z.object({ email: z.string().trim().email("Adresse e-mail invalide") });

authRouter.post("/forgot-password", accountLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" });

  // Always answer the same way so the endpoint can't reveal which emails have an account.
  const user = await findUserByEmail(parsed.data.email);
  if (!user) return res.json({ ok: true });

  const recent = await prisma.passwordResetCode.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_RESEND_COOLDOWN_MS) } },
  });
  if (recent) return res.json({ ok: true });

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await prisma.passwordResetCode.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetCode.create({
    data: { userId: user.id, codeHash: hashResetCode(code), expiresAt: new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60_000) },
  });

  try {
    await sendPasswordResetCode({ email: user.email, name: user.name }, code, RESET_CODE_TTL_MINUTES);
  } catch (err) {
    console.error("[auth] password reset mail failed", err);
    await prisma.passwordResetCode.deleteMany({ where: { userId: user.id } });
    // 500, not 502: the app retries 502/503/504 as a sleeping-server symptom.
    return res.status(500).json({ error: "L'e-mail n'a pas pu être envoyé. Réessaie dans un instant." });
  }
  res.json({ ok: true });
});

const resetSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide"),
  code: z.string().trim().regex(/^\d{6}$/, "Le code contient 6 chiffres"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

authRouter.post("/reset-password", loginLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" });
  const { email, code, password } = parsed.data;

  const invalid = () => res.status(400).json({ error: "Code invalide ou expiré" });

  const user = await findUserByEmail(email);
  if (!user) return invalid();

  const stored = await prisma.passwordResetCode.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (!stored || stored.expiresAt < new Date() || stored.attempts >= RESET_MAX_ATTEMPTS) return invalid();

  const matches = crypto.timingSafeEqual(Buffer.from(hashResetCode(code)), Buffer.from(stored.codeHash));
  if (!matches) {
    await prisma.passwordResetCode.update({ where: { id: stored.id }, data: { attempts: { increment: 1 } } });
    return invalid();
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetCode.deleteMany({ where: { userId: user.id } }),
    // Sign out every other device that knew the old password.
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
  ]);

  const tokens = await issueTokens(user.id, user.email);
  res.json({ user: publicUser(user), ...tokens });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined;
  if (!refreshToken) return res.status(400).json({ error: "Missing refreshToken" });

  const hash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
  if (!stored || stored.expiresAt < new Date()) return res.status(401).json({ error: "Invalid refresh token" });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return res.status(401).json({ error: "Invalid refresh token" });

  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const tokens = await issueTokens(user.id, user.email);
  res.json({ user: publicUser(user), ...tokens });
});

authRouter.post("/logout", async (req, res) => {
  const refreshToken = req.body?.refreshToken as string | undefined;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashRefreshToken(refreshToken) } });
  }
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.accountId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: publicUser(user) });
});

// Change one's display name (shown as « Salut, … » and in the avatar).
authRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(1, "Un prénom est nécessaire").max(80, "Nom trop long") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const user = await prisma.user.update({ where: { id: req.accountId }, data: { name: parsed.data.name, initials: initialsFor(parsed.data.name) } });
  res.json({ user: publicUser(user) });
});

// Delete one's account and everything in it (RGPD right to erasure, also
// required by the Play Store). The password confirms it's really the owner.
// Every table cascades from User; stored files (R2) are removed first.
authRouter.delete("/me", requireAuth, loginLimiter, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1, "Mot de passe requis"), confirmFamily: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const user = await prisma.user.findUnique({ where: { id: req.accountId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ error: "Mot de passe incorrect" });
  // The owner's account IS the family's data: deleting it removes it for everyone who joined.
  const others = user.familyOwnerId ? 0 : await prisma.user.count({ where: { familyOwnerId: user.id } });
  if (others > 0 && parsed.data.confirmFamily !== true) {
    return res.status(409).json({
      error: `${others} autre${others > 1 ? "s" : ""} compte${others > 1 ? "s" : ""} utilise${others > 1 ? "nt" : ""} cette famille : ${others > 1 ? "ils perdront" : "il perdra"} l'accès au planning partagé. Confirme pour tout supprimer.`,
      code: "family_has_members",
      members: others,
    });
  }
  const files = await prisma.document.findMany({ where: { userId: user.id }, select: { fileKey: true } });
  await removeObjects(files.map((f) => f.fileKey));
  await prisma.user.delete({ where: { id: user.id } });
  res.status(204).end();
});

async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ sub: userId, email });
  const { token: refreshToken, hash, expiresAt } = generateRefreshToken();
  await prisma.refreshToken.create({ data: { userId, tokenHash: hash, expiresAt } });
  return { accessToken, refreshToken };
}

function publicUser(user: { id: string; email: string; name: string; initials: string; familyOwnerId: string | null; familyRole: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    initials: user.initials,
    /** The family's id (the owner's): what the store identifies the subscription with. */
    familyId: user.familyOwnerId ?? user.id,
    /** "owner" | "full" | "planning". */
    familyRole: user.familyOwnerId ? user.familyRole : "owner",
  };
}

// exported for the calendar OAuth callback routes, which authenticate the
// in-flight request via the access token embedded in `state`.
export function userIdFromAccessToken(token: string): string {
  return verifyAccessToken(token).sub;
}
