import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Reads a recipe from a web page. Most recipe sites (Marmiton, 750g,
// Cuisine AZ, BBC Good Food…) embed it as schema.org JSON-LD for search
// engines; that's the only format we parse — no fragile HTML scraping.

export interface ImportedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function clean(text: unknown): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code: string) => {
      if (code[0] === "#") {
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}

function isRecipe(node: unknown): node is Record<string, unknown> {
  if (!node || typeof node !== "object") return false;
  const type = (node as Record<string, unknown>)["@type"];
  return type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
}

function findRecipe(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  if (isRecipe(node)) return node;
  const obj = node as Record<string, unknown>;
  return findRecipe(obj["@graph"]) ?? findRecipe(obj.mainEntity);
}

function instructions(value: unknown): string[] {
  if (typeof value === "string") {
    // One block of text: split on line breaks, else keep it whole.
    const lines = value.split(/\n+|<br\s*\/?>/i).map(clean).filter(Boolean);
    return lines;
  }
  if (Array.isArray(value)) return value.flatMap(instructions);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.itemListElement) return instructions(obj.itemListElement); // HowToSection
    const text = clean(obj.text ?? obj.name);
    return text ? [text] : [];
  }
  return [];
}

/** Recipe found in the page's JSON-LD, or null. */
export function parseRecipeFromHtml(html: string): ImportedRecipe | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(json.trim());
    } catch {
      continue;
    }
    const recipe = findRecipe(data);
    if (!recipe) continue;
    const title = clean(recipe.name);
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map(clean).filter(Boolean);
    const steps = instructions(recipe.recipeInstructions);
    if (!title && ingredients.length === 0) continue;
    const yieldText = clean(Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield);
    return { title: title || "Recette importée", ingredients, steps, notes: yieldText ? `Pour ${yieldText}.` : "" };
  }
  return null;
}

/** True for loopback, private, link-local and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export class ImportError extends Error {}

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Downloads the page and extracts its recipe. Refuses anything but public
 * http(s) addresses so the server can't be pointed at internal services.
 */
export async function importRecipeFromUrl(raw: string, fetchImpl: typeof fetch = fetch): Promise<ImportedRecipe> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportError("Adresse invalide.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ImportError("Seules les adresses http(s) sont acceptées.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) throw new ImportError("Site introuvable.");
  if (addresses.some(isPrivateAddress)) throw new ImportError("Adresse non autorisée.");

  const res = await fetchImpl(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; PasserelleRecipeImport/1.0)", Accept: "text/html" },
  }).catch(() => {
    throw new ImportError("La page n'a pas pu être chargée.");
  });
  if (!res.ok) throw new ImportError("La page n'a pas pu être chargée.");
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new ImportError("Page trop lourde.");
  const html = (await res.text()).slice(0, MAX_BYTES);

  const recipe = parseRecipeFromHtml(html);
  if (!recipe) throw new ImportError("Aucune recette reconnue sur cette page.");
  return recipe;
}
