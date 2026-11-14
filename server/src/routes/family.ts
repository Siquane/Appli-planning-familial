import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import bcrypt from "bcryptjs";
import { INVITE_TTL_DAYS, InviteError, MAX_FAMILY_ACCOUNTS, findLiveInvite, generateFamilyCode } from "../lib/family";
import { contentCounts, eraseContent, totalOf } from "../lib/familyJoin";
import { loginLimiter } from "../middleware/rateLimits";
import { publicUser } from "./auth";

// The accounts around one family, and the code to add someone.

export const familyRouter = Router();
familyRouter.use(requireAuth);

const ownerOnly = (req: import("express").Request, res: import("express").Response) => {
  if (req.familyRole === "owner") return true;
  res.status(403).json({ error: "Seul le créateur de la famille peut faire ça." });
  return false;
};

familyRouter.get("/", async (req, res) => {
  const familyId = req.familyId!;
  const accounts = await prisma.user.findMany({
    where: { OR: [{ id: familyId }, { familyOwnerId: familyId }] },
    select: { id: true, name: true, initials: true, familyRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const invite = req.familyRole === "owner" ? await prisma.familyInvite.findUnique({ where: { ownerId: familyId } }) : null;
  res.json({
    role: req.familyRole,
    maxAccounts: MAX_FAMILY_ACCOUNTS,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      initials: a.initials,
      role: a.id === familyId ? "owner" : a.familyRole,
      isMe: a.id === req.accountId,
    })),
    invite: invite ? { code: invite.code, role: invite.role, expiresAt: invite.expiresAt.toISOString(), expired: invite.expiresAt < new Date() } : null,
  });
});

// A new code replaces the previous one; it expires after INVITE_TTL_DAYS.
familyRouter.post("/invite", async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const parsed = z.object({ role: z.enum(["full", "planning"]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choisis le profil : complet ou planning." });
  const ownerId = req.familyId!;
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFamilyCode();
    try {
      const invite = await prisma.familyInvite.upsert({
        where: { ownerId },
        update: { code, role: parsed.data.role, expiresAt, createdAt: new Date() },
        create: { ownerId, code, role: parsed.data.role, expiresAt },
      });
      return res.status(201).json({ invite: { code: invite.code, role: invite.role, expiresAt: invite.expiresAt.toISOString(), expired: false } });
    } catch (e) {
      // Two codes colliding is astronomically unlikely; try another.
      if (attempt === 4) throw e;
    }
  }
});

familyRouter.delete("/invite", async (req, res) => {
  if (!ownerOnly(req, res)) return;
  await prisma.familyInvite.deleteMany({ where: { ownerId: req.familyId! } });
  res.status(204).end();
});

// The owner removes an account from the family. That account keeps existing,
// on its own and without the family's data.
familyRouter.delete("/accounts/:id", async (req, res) => {
  if (!ownerOnly(req, res)) return;
  const { count } = await prisma.user.updateMany({
    where: { id: String(req.params.id), familyOwnerId: req.familyId! },
    data: { familyOwnerId: null, familyRole: "owner" },
  });
  if (count === 0) return res.status(404).json({ error: "Ce compte ne fait pas partie de ta famille." });
  res.status(204).end();
});

// An account leaves the family it joined.
familyRouter.post("/leave", async (req, res) => {
  if (req.familyRole === "owner") return res.status(400).json({ error: "Tu es le créateur de cette famille : supprime-la depuis ton compte, ou retire les autres comptes." });
  await prisma.user.update({ where: { id: req.accountId! }, data: { familyOwnerId: null, familyRole: "owner" } });
  res.status(204).end();
});

// The account has read the message about the family changing hands.
familyRouter.delete("/notice", async (req, res) => {
  await prisma.user.update({ where: { id: req.accountId! }, data: { familyNotice: null } });
  res.status(204).end();
});

// An existing account joins a family with a code. It must not belong to a
// family already, nor have people in its own; what it holds must be empty, or
// erased when the person confirms with their password.
familyRouter.post("/join", loginLimiter, async (req, res) => {
  const parsed = z.object({ code: z.string().min(1, "Saisis le code famille"), erase: z.boolean().optional(), password: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" });
  const accountId = req.accountId!;
  const user = await prisma.user.findUnique({ where: { id: accountId } });
  if (!user) return res.status(404).json({ error: "Not found" });
  if (user.familyOwnerId) return res.status(400).json({ error: "Tu fais déjà partie d'une famille. Quitte-la d'abord pour en rejoindre une autre.", code: "already_in_family" });
  const others = await prisma.user.count({ where: { familyOwnerId: accountId } });
  if (others > 0) {
    return res.status(409).json({ error: "D'autres comptes partagent déjà ta famille. Retire-les ou confie ta famille avant d'en rejoindre une autre.", code: "family_has_members" });
  }

  let invite;
  try {
    invite = await findLiveInvite(parsed.data.code);
  } catch (e) {
    if (e instanceof InviteError) return res.status(400).json({ error: e.message, code: "invalid_family_code" });
    throw e;
  }
  if (invite.ownerId === accountId) return res.status(400).json({ error: "C'est ton propre code famille : il sert à inviter quelqu'un d'autre.", code: "own_code" });

  const counts = await contentCounts(accountId);
  if (totalOf(counts) > 0) {
    if (parsed.data.erase !== true) {
      return res.status(409).json({
        error: "Ton compte contient déjà des informations (planning, budget ou documents). Pour rejoindre la famille, elles doivent être effacées : confirme avec ton mot de passe.",
        code: "account_not_empty",
        counts,
      });
    }
    if (!parsed.data.password || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    await eraseContent(accountId);
  }

  const joined = await prisma.$transaction(async (tx) => {
    await tx.familyInvite.deleteMany({ where: { ownerId: accountId } });
    return tx.user.update({ where: { id: accountId }, data: { familyOwnerId: invite.ownerId, familyRole: invite.role, familyNotice: null } });
  });
  res.json({ user: publicUser(joined) });
});
