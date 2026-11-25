import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { resolveSpace, type FamilyRole } from "../lib/family";
import { childAllowed } from "../lib/childAccess";
import { prisma } from "../db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * The id every route keys its data by: the FAMILY's id (the owner's).
       * Routers for budget and documents switch it to `privateId` with
       * privateSpace, so a « planning » account gets its own.
       */
      userId?: string;
      userEmail?: string;
      /** The signed-in account itself. */
      accountId?: string;
      familyId?: string;
      privateId?: string;
      familyRole?: FamilyRole;
      /** Compte enfant : son membre de la famille. */
      childMemberId?: string | null;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  let accountId: string;
  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    accountId = payload.sub;
    req.userEmail = payload.email;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  const space = await resolveSpace(accountId);
  if (!space) return res.status(401).json({ error: "Invalid or expired token" });
  req.accountId = space.accountId;
  req.familyId = space.familyId;
  req.privateId = space.privateId;
  req.familyRole = space.role;
  req.childMemberId = space.childMemberId ?? null;
  req.userId = space.familyId;
  if (space.role === "child" && !childAllowed(req.method, `${req.baseUrl}${req.path}`)) {
    return res.status(403).json({ error: "Demande à un parent de le faire.", code: "child_forbidden" });
  }
  // « Espace de Jules » : un parent (propriétaire ou accès complet) consulte et
  // gère le budget et les documents d'un enfant (en-tête X-Child-Space = id du
  // membre). Un accès « planning » garde ses propres données et ne l'ouvre pas.
  const childSpace = req.header("x-child-space");
  if (childSpace && space.role === "planning") {
    return res.status(403).json({ error: "Seul un parent avec l'accès complet peut ouvrir l'espace d'un enfant.", code: "child_space_forbidden" });
  }
  if (childSpace && (space.role === "owner" || space.role === "full")) {
    const child = await prisma.user.findFirst({ where: { childMemberId: childSpace, familyOwnerId: space.familyId, familyRole: "child" }, select: { id: true } });
    if (!child) return res.status(404).json({ error: "Cet enfant n'a pas d'accès à Passerelle.", code: "child_space_not_found" });
    req.privateId = child.id;
  }
  next();
}

/**
 * For routes about money and documents: from here on `req.userId` is where this
 * account's budget and documents live (the family's for owner and « full »
 * accounts, its own for « planning »). `req.familyId` stays the family.
 */
export function privateSpace(req: Request, _res: Response, next: NextFunction) {
  req.userId = req.privateId;
  next();
}
