// The shop where the child dresses Cervelle. Pure: the catalogue, what is on
// sale on a given day, and who owns what. The drawings live in the app
// (cervelle: src/components/mascot/geometry.ts), keyed by the same ids.
//
// Slots: one item per slot. « couleur » is the brain's colour (« rose » is the
// default, free), « decor » is the scene behind Cervelle (none by default).
//
// Kinds:
//   normal      always on sale;
//   saison      on sale only between two dates each year, kept forever once bought;
//   legendaire  very expensive, a long-term goal;
//   badge       not for sale: unlocked by earning a badge (src/lib/cervelle/badges.ts);
//   chemin      not for sale: the prize at the end of a month's « chemin d'étoiles » (stars.ts).

export type Slot = "tete" | "visage" | "cou" | "tenue" | "main" | "couleur" | "decor";
export const SLOTS: Slot[] = ["tete", "visage", "cou", "tenue", "main", "couleur", "decor"];

export type Kind = "normal" | "saison" | "legendaire" | "badge" | "chemin";

export interface CatalogItem {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  kind: Kind;
  /** saison: first and last day each year, « MM-DD » (may wrap over New Year). */
  season?: [string, string];
  /** badge: key of the badge that unlocks it (« regulier:3 », or « fete:noel » for any year). */
  badge?: { key: string; label: string };
}

const n = (id: string, name: string, slot: Slot, price: number): CatalogItem => ({ id, name, slot, price, kind: "normal" });
const s = (id: string, name: string, slot: Slot, price: number, from: string, to: string): CatalogItem => ({ id, name, slot, price, kind: "saison", season: [from, to] });
const l = (id: string, name: string, slot: Slot, price: number): CatalogItem => ({ id, name, slot, price, kind: "legendaire" });
const b = (id: string, name: string, slot: Slot, key: string, label: string): CatalogItem => ({ id, name, slot, price: 0, kind: "badge", badge: { key, label } });
const c = (id: string, name: string, slot: Slot): CatalogItem => ({ id, name, slot, price: 0, kind: "chemin" });

export const SHOP: CatalogItem[] = [
  // Tête
  n("casquette", "Casquette", "tete", 30),
  n("bandeau", "Bandeau de sport", "tete", 35),
  n("beret", "Béret", "tete", 50),
  n("paille", "Chapeau de paille", "tete", 60),
  n("toque", "Toque de chef", "tete", 70),
  n("casque", "Casque audio", "tete", 80),
  n("antennes", "Antennes d'extraterrestre", "tete", 90),
  n("sorcier", "Chapeau de magicien", "tete", 100),
  n("viking", "Casque de viking", "tete", 110),
  n("diplome", "Toque de diplômé", "tete", 120),
  n("couronne", "Couronne", "tete", 150),
  s("bonnet_noel", "Bonnet de Noël", "tete", 60, "12-01", "01-06"),
  s("citrouille", "Chapeau citrouille", "tete", 60, "10-15", "11-05"),
  s("lapin", "Oreilles de lapin", "tete", 50, "03-15", "04-30"),
  l("couronne_diamant", "Couronne de diamants", "tete", 600),
  b("couronne_or", "Couronne d'or", "tete", "regulier:3", "Régulier en or"),
  b("explorateur", "Chapeau d'explorateur", "tete", "explorateur:3", "Explorateur en or"),

  // Visage
  n("lunettes", "Lunettes rondes", "visage", 40),
  n("paillettes", "Joues pailletées", "visage", 35),
  n("moustache", "Moustache", "visage", 45),
  n("soleil", "Lunettes de soleil", "visage", 50),
  n("monocle", "Monocle", "visage", 70),
  n("masque", "Masque de super-héros", "visage", 90),
  b("chauve_souris", "Masque chauve-souris", "visage", "fete:halloween", "Halloween"),

  // Cou
  n("foulard", "Foulard", "cou", 40),
  n("cravate", "Cravate", "cou", 45),
  n("noeud", "Nœud papillon", "cou", 50),
  n("collier", "Collier de fleurs", "cou", 55),
  n("echarpe", "Écharpe", "cou", 60),
  b("medaille", "Médaille d'or", "cou", "as_interro:3", "Persévérant en or"),
  b("guirlande", "Guirlande", "cou", "fete:noel", "Noël"),

  // Tenue (autour de Cervelle)
  n("cape", "Cape de héros", "tenue", 120),
  n("ailes_papillon", "Ailes de papillon", "tenue", 150),
  s("bouee", "Bouée canard", "tenue", 80, "06-15", "08-31"),
  l("ailes_ange", "Ailes d'ange", "tenue", 700),

  // Dans la main
  n("crayon", "Crayon", "main", 30),
  n("livre", "Livre", "main", 40),
  n("ballon", "Ballon", "main", 50),
  n("loupe", "Loupe", "main", 60),
  n("baguette", "Baguette magique", "main", 90),
  s("glace", "Glace", "main", 40, "06-15", "08-31"),
  b("trophee", "Trophée", "main", "sans_faute:3", "Correcteur en or"),
  b("appareil", "Appareil photo", "main", "photographe:3", "Photographe en or"),

  // Couleur de Cervelle
  n("rose", "Rose (d'origine)", "couleur", 0),
  n("bleu", "Bleu", "couleur", 80),
  n("vert", "Vert", "couleur", 80),
  n("violet", "Violet", "couleur", 80),
  n("orange", "Orange", "couleur", 80),
  n("arc_en_ciel", "Arc-en-ciel", "couleur", 300),
  l("galaxie", "Galaxie", "couleur", 800),
  b("dore", "Doré", "couleur", "memoire:3", "Mémoire d'éléphant en or"),

  // Chemin d'étoiles : le cadeau du 50e palier, un par thème du mois
  c("casque_astronaute", "Casque d'astronaute", "tete"),
  c("tuba", "Masque et tuba", "visage"),
  c("couronne_feuilles", "Couronne de feuilles", "tete"),
  c("cape_etoiles", "Cape étoilée", "tenue"),

  // Décor
  n("classe", "Salle de classe", "decor", 120),
  n("bibliotheque", "Bibliothèque", "decor", 150),
  n("plage", "Plage", "decor", 150),
  n("foret", "Forêt", "decor", 150),
  n("espace", "Espace", "decor", 200),
  s("neige", "Paysage de neige", "decor", 120, "12-01", "02-28"),
  l("aurore", "Aurore boréale", "decor", 1000),
];

export function shopItem(id: string): CatalogItem | null {
  return SHOP.find((i) => i.id === id) ?? null;
}

/** Free items everyone has (the original pink). */
export const FREE = SHOP.filter((i) => i.kind === "normal" && i.price === 0).map((i) => i.id);

/** On sale on `day` (« YYYY-MM-DD »)? Badge items never are. */
export function onSale(item: CatalogItem, day: string): boolean {
  if (item.kind === "badge" || item.kind === "chemin") return false;
  if (item.kind !== "saison" || !item.season) return true;
  const md = day.slice(5);
  const [from, to] = item.season;
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** Unlocked by one of these stored badge keys? « fete:noel » matches any year. */
export function unlockedBy(item: CatalogItem, badgeKeys: string[]): boolean {
  if (!item.badge) return false;
  const k = item.badge.key;
  return badgeKeys.some((b) => b === k || b.startsWith(`${k}:`));
}

export function owns(item: CatalogItem, owned: string[], badgeKeys: string[]): boolean {
  return owned.includes(item.id) || FREE.includes(item.id) || unlockedBy(item, badgeKeys);
}

/** Equipping an item takes its slot's place. Pink is no item: it just clears the colour. */
export function equip(equipped: string[], id: string): string[] {
  const item = shopItem(id);
  if (!item) return equipped;
  const rest = equipped.filter((e) => shopItem(e)?.slot !== item.slot);
  return FREE.includes(id) ? rest : [...rest, id];
}

/** Keeps one item per slot, only known items that are owned. */
export function cleanOutfit(items: string[], owned: string[], badgeKeys: string[]): string[] {
  let out: string[] = [];
  for (const id of items) {
    const item = shopItem(id);
    if (item && owns(item, owned, badgeKeys)) out = equip(out, id);
  }
  return out;
}

export const OUTFITS = 3;

/** Saved outfits as stored (Json), made safe. */
export function readOutfits(raw: unknown): (string[] | null)[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: OUTFITS }, (_, i) => {
    const o = list[i];
    return Array.isArray(o) ? o.filter((x): x is string => typeof x === "string") : null;
  });
}
