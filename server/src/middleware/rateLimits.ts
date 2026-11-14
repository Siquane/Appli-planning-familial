import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

// Brute-force protection on the auth endpoints. Limits are per client IP
// (Render sits behind one proxy hop, see `trust proxy` in index.ts) and, for
// login, per IP + email so one family member's typos don't lock out another.
// Tests set DISABLE_RATE_LIMIT=1 (tests/setupEnv.ts) except the one that
// checks the limit itself.

const skip = () => process.env.DISABLE_RATE_LIMIT === "1";
const message = (minutes: number) => ({ error: `Trop de tentatives. Réessaie dans ${minutes} minutes.` });

const emailOf = (req: Request) => (typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "");

/** 10 failed or successful logins per 15 min for one email from one IP. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  // ipKeyGenerator groups an IPv6 address by its /56 block (one home network).
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${emailOf(req)}`,
  message: message(15),
});

/** Account creation and reset-code requests: 10 per hour per IP. */
export const accountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: message(60),
});

/** Reading a bank statement is heavy: 20 per hour per family. */
export const statementLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  keyGenerator: (req) => req.userId ?? ipKeyGenerator(req.ip ?? ""),
  message: { error: "Trop d'imports d'un coup. Réessaie dans une heure." },
});
