import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "../db";
import { verifyAccessToken } from "../lib/jwt";

// Cervelle reçoit des photos de cours dans le corps des requêtes (jusqu'à
// 40 Mo). Ce gros corps n'est lu que pour un appelant identifié (jeton de
// parent ou d'appareil enfant « cv_… ») ; sans identité valable, la limite
// habituelle de 100 ko s'applique, pour que personne ne puisse saturer la
// mémoire du serveur avec de gros envois anonymes.

const bigJson = express.json({ limit: "40mb" });
const smallJson = express.json();
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function isKnownCaller(header: string | undefined): Promise<boolean> {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length);
  if (token.startsWith("cv_")) {
    const device = await prisma.learnerDevice.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true } });
    return !!device;
  }
  try {
    verifyAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export async function cervelleBody(req: Request, res: Response, next: NextFunction) {
  const known = await isKnownCaller(req.headers.authorization);
  (known ? bigJson : smallJson)(req, res, next);
}
