import crypto from "node:crypto";
import { prisma } from "../db";

// Family sharing.
//
// A family is the data of its creator (the « owner »): every table keys its
// rows by the owner's user id. Another adult or teen joins with a code and gets
// their own account around that same data:
//   - "full"     shares everything, budget and documents included;
//   - "planning" shares the planning (tasks, meals, shopping, recipes, members…)
//                and keeps a private budget and private documents.
// Packs, trial and meal quotas always belong to the owner: one subscription
// for the whole family.

export type FamilyRole = "owner" | "full" | "planning" | "child";
export type JoinRole = "full" | "planning";

export const INVITE_TTL_DAYS = 7;
export const MAX_FAMILY_ACCOUNTS = 6;

/** Where an account's data lives. */
export interface Space {
  /** The signed-in account. */
  accountId: string;
  /** The family's data: the owner's id (own id for an owner). */
  familyId: string;
  /** Where this account's budget and documents live. */
  privateId: string;
  role: FamilyRole;
  /** Compte enfant : le membre de la famille qu'il est. */
  childMemberId?: string | null;
}

export async function resolveSpace(accountId: string): Promise<Space | null> {
  const user = await prisma.user.findUnique({ where: { id: accountId }, select: { id: true, familyOwnerId: true, familyRole: true, childMemberId: true } });
  if (!user) return null;
  if (user.familyRole === "child") {
    // Un compte enfant sans famille n'a plus lieu d'être (il est supprimé avec elle).
    if (!user.familyOwnerId) return null;
    return { accountId: user.id, familyId: user.familyOwnerId, privateId: user.id, role: "child", childMemberId: user.childMemberId };
  }
  if (!user.familyOwnerId) return { accountId: user.id, familyId: user.id, privateId: user.id, role: "owner" };
  const role: FamilyRole = user.familyRole === "planning" ? "planning" : "full";
  return { accountId: user.id, familyId: user.familyOwnerId, privateId: role === "planning" ? user.id : user.familyOwnerId, role };
}

/** The family an account belongs to (itself when it owns one). Packs and trial are read there. */
export async function familyIdOf(accountId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: accountId }, select: { familyOwnerId: true } });
  return user?.familyOwnerId ?? accountId;
}

// No 0/O, 1/I/L: a code read out loud or on a screen can't be mistaken.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** « K7F2-9QXA ». */
export function generateFamilyCode(): string {
  const pick = () => ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  const raw = Array.from({ length: 8 }, pick).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/** What a person typed → the stored form: upper case, no spaces or dashes, dash restored. */
export function normalizeFamilyCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 8 || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export class InviteError extends Error {}

/** The live invite for this code, or throws with a message meant for the person joining. */
export async function findLiveInvite(input: string) {
  const code = normalizeFamilyCode(input);
  if (!code) throw new InviteError("Ce code famille n'est pas valide. Il a 8 caractères, par exemple K7F2-9QXA.");
  const invite = await prisma.familyInvite.findUnique({ where: { code }, include: { owner: { select: { id: true, name: true } } } });
  if (!invite) throw new InviteError("Ce code famille n'existe pas ou a été remplacé. Demande-en un nouveau.");
  if (invite.expiresAt < new Date()) throw new InviteError("Ce code famille a expiré. Demande-en un nouveau.");
  // Les comptes enfants ne comptent pas dans la limite.
  const accounts = await prisma.user.count({ where: { OR: [{ id: invite.ownerId }, { familyOwnerId: invite.ownerId, familyRole: { not: "child" } }] } });
  if (accounts >= MAX_FAMILY_ACCOUNTS) throw new InviteError(`Cette famille est complète (${MAX_FAMILY_ACCOUNTS} comptes au plus).`);
  return invite;
}
