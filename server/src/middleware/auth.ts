import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { resolveSpace, type FamilyRole } from "../lib/family";

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
  req.userId = space.familyId;
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
