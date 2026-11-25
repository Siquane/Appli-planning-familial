import crypto from "node:crypto";
import { env } from "../env";

// Chiffre les secrets gardés en base (accès aux agendas Google et Outlook) :
// si la base fuyait, ils resteraient illisibles. AES-256-GCM, clé dérivée du
// secret des sessions (aucune variable de plus à régler sur Render). Changer
// ce secret oblige seulement à reconnecter les agendas.

const PREFIX = "v1:";
const key = crypto.hkdfSync("sha256", env.jwtAccessSecret, "passerelle", "calendar-tokens", 32);

export function seal(plain: string): string;
export function seal(plain: string | null): string | null;
export function seal(plain: string | null): string | null {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

/** Le secret en clair. Une valeur d'avant le chiffrement (sans « v1: ») est rendue telle quelle. */
export function open(stored: string): string;
export function open(stored: string | null): string | null;
export function open(stored: string | null): string | null {
  if (stored == null || !stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export const isSealed = (stored: string | null) => !!stored?.startsWith(PREFIX);
