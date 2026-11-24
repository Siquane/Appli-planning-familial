import crypto from "node:crypto";
import { prisma } from "../db";
import { removeObjects } from "./storage";
import { generateFamilyCode, normalizeFamilyCode } from "./family";
import { memberAge } from "./stars";

// Comptes « enfant » : un parent crée l'accès de son enfant (8 à 14 ans) depuis
// la fiche du membre, ce qui vaut accord parental (sous 15 ans, RGPD en France).
// L'enfant se connecte avec un code à usage unique, sans e-mail ni mot de passe.
// Il partage le planning de la famille, a son propre budget et ses propres
// documents (que les parents peuvent consulter), et ne gère pas la famille.

export const CHILD_MIN_AGE = 8;
export const CHILD_MAX_AGE = 14;
export const CHILD_CODE_TTL_HOURS = 24;

const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");

export type ChildAgeProblem = "unknown" | "too_young" | "too_old";

/** Pourquoi ce membre ne peut pas avoir d'accès enfant, ou null s'il le peut. */
export function childAgeProblem(member: { age: number | null; birthday: Date | null }, now: Date = new Date()): ChildAgeProblem | null {
  const age = memberAge(member, now);
  if (age == null) return "unknown";
  if (age < CHILD_MIN_AGE) return "too_young";
  if (age > CHILD_MAX_AGE) return "too_old";
  return null;
}

/** Le compte enfant de ce membre, créé s'il n'existe pas encore. */
export async function ensureChildAccount(familyId: string, member: { id: string; name: string; initials: string }) {
  const existing = await prisma.user.findUnique({ where: { childMemberId: member.id } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      // Jamais utilisée pour se connecter : l'adresse doit seulement être unique.
      email: `enfant-${crypto.randomUUID()}@enfants.passerelle.invalid`,
      passwordHash: crypto.randomBytes(32).toString("hex"),
      name: member.name,
      initials: member.initials,
      familyOwnerId: familyId,
      familyRole: "child",
      childMemberId: member.id,
      constraints: { create: {} },
    },
  });
}

/** Un nouveau code de connexion pour ce compte ; les précédents ne marchent plus. */
export async function newChildCode(accountId: string): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + CHILD_CODE_TTL_HOURS * 3_600_000);
  await prisma.childLoginCode.deleteMany({ where: { accountId } });
  for (let attempt = 0; ; attempt++) {
    const code = generateFamilyCode();
    try {
      await prisma.childLoginCode.create({ data: { accountId, codeHash: hashCode(code), expiresAt } });
      return { code, expiresAt };
    } catch (e) {
      if (attempt >= 4) throw e;
    }
  }
}

/** Le compte qui correspond à ce code (consommé), ou null. */
export async function consumeChildCode(input: string): Promise<string | null> {
  const code = normalizeFamilyCode(input);
  if (!code) return null;
  const row = await prisma.childLoginCode.findUnique({ where: { codeHash: hashCode(code) } });
  if (!row) return null;
  await prisma.childLoginCode.delete({ where: { id: row.id } });
  return row.expiresAt > new Date() ? row.accountId : null;
}

/** Supprime le compte enfant et ses fichiers (documents). */
export async function deleteChildAccount(accountId: string): Promise<void> {
  const files = await prisma.document.findMany({ where: { userId: accountId }, select: { fileKey: true } });
  await removeObjects(files.map((f) => f.fileKey));
  await prisma.user.deleteMany({ where: { id: accountId, familyRole: "child" } });
}

/** Supprime tous les comptes enfants d'une famille (famille dissoute). */
export async function deleteChildAccountsOf(familyId: string): Promise<void> {
  const children = await prisma.user.findMany({ where: { familyOwnerId: familyId, familyRole: "child" }, select: { id: true } });
  for (const c of children) await deleteChildAccount(c.id);
}

// Ce qu'un compte enfant ne peut pas faire. Lecture : tout sauf ces chemins.
// Écriture : rien sur ces chemins (gestion de la famille, repas, étoiles,
// achats, agendas externes, Cervelle). Les tâches sont vérifiées dans leur route.
const READ_BLOCKED = ["/share", "/calendar", "/billing", "/cervelle", "/family/children", "/splits"];
const WRITE_BLOCKED = ["/members", "/family", "/share", "/constraints", "/calendar", "/recipes", "/meals", "/shopping", "/stars", "/billing", "/plan", "/cervelle", "/pocket-money", "/splits"];
const WRITE_ALLOWED = ["/family/notice"];
// Demander une récompense (le reste des étoiles reste aux adultes) ; rembourser
// une avance avec sa cagnotte (le reste de l'argent de poche reste aux adultes).
// Les comptes partagés (/splits) sont ceux des adultes.
const WRITE_ALLOWED_PATTERNS = [/^\/stars\/rewards\/[^/]+\/request$/, /^\/pocket-money\/advances\/[^/]+\/repay$/];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function childAllowed(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD") return !READ_BLOCKED.some((p) => under(path, p));
  if (WRITE_ALLOWED.some((p) => under(path, p)) || WRITE_ALLOWED_PATTERNS.some((r) => r.test(path))) return true;
  return !WRITE_BLOCKED.some((p) => under(path, p));
}
