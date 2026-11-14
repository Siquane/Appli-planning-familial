import { labelKey, stripAccents } from "./statementParser";

// First guess of the category of a bank line, from well-known French
// merchants. Order matters: the first rule that matches wins. The family's own
// corrections (ImportRule) are applied before these, see categorize().
// Categories are the fixed keys of expenseCategories.ts.

const RULES: [RegExp, string][] = [
  // Housing, energy, insurance first: a transfer « Loyer » must not fall into « divers ».
  [/\bloyer\b|\bcharges? locatives?\b|\bsyndic\b|\bfonciere\b/, "logement"],
  [/\bengie\b|\bedf\b|\btotalenergies\b|\bveolia\b|\bsuez\b|\beau de\b|\bgaz de\b|\benergie\b|\belectricite\b/, "énergie"],
  [/assurance|pacifica|predica|\bmaif\b|\bmacif\b|\bmatmut\b|\baxa\b|\bgroupama\b|\bgarantie (deces|obseques|privee)|\bmutuelle\b|\bcotisation du contrat\b/, "assurances"],
  [/\bimpots?\b|\bdgfip\b|\btresor public\b|\btaxe\b/, "impôts"],
  [/livret|\bepargne\b|\bpel\b|\bassurance[- ]vie\b|\bass\.?vie\b/, "épargne"],
  // Subscriptions & telecom.
  [/canal\s?\+?|netflix|spotify|disney|deezer|prime video|youtube|apple\.com|icloud|adobe|google (play|one)|microsoft|dropbox|openai|chatgpt|free mobile|\bfree\b|bouygues|orange|\bsfr\b|\bsosh\b|red by|la poste mobile|nordvpn|paypal/, "abonnements"],
  // Food at home before restaurants: « Boucherie » alone is a butcher, « La Boucherie » a restaurant.
  [/\bla boucherie\b|burger king|mcdo|mcdonald|\bkfc\b|\bquick\b|subway|pizza|pizz|kebab|restaurant|brasserie|\bbar\b|\bcafe\b|sumup|food and co|\bbistro\b|sushi|\bwok\b|traiteur|\bcrescendo\b|bastion|ateliers|dallmayr/, "restaurants"],
  [/carrefour|\blidl\b|leclerc|intermarche|auchan|monoprix|franprix|\bpicard\b|\baldi\b|\bcasino\b|\bspar\b|\bsimply\b|\bnetto\b|biocoop|boulangerie|boucherie|primeur|marche\b|market\b|sobedis|\bdrive\b|\bsuper u\b|\bu express\b|cora\b/, "courses"],
  // Transport.
  [/\bessof?\b|\bshell\b|\bbp\b|\btotal\b|avia\b|carburant|station|certas|\bsncf\b|\bratp\b|peage|autoroute|\buber\b|\bbolt\b|parking|\bapf\b|vinci|blablacar|\bnavigo\b|\btransdev\b|ginko|garage|norauto|midas|\bfeu vert\b/, "transport"],
  // Health.
  [/pharmacie|medecin|docteur|\bdr\b|dentiste|opticien|\boptic|laboratoire|\bclinique\b|hopital|kine|osteo|ophtalmo|\bselarl\b|\bmedical\b|\bdoctolib\b/, "santé"],
  // Children, pets, leisure, shopping.
  [/\becole\b|\bcreche\b|\bcantine\b|peri ?scolaire|nounou|assistante maternelle|\bjouets?\b|picwic|king jouet|\bhello ?asso\b|\bsport\b/, "enfants"],
  [/litiere|truffaut|animalis|veterinaire|\bveto\b|\bzooplus\b|\bmedor\b/, "animaux"],
  [/\bfdj\b|francaise des jeux|cinema|\bugc\b|\bpathe\b|steam|playstation|nintendo|\bxbox\b|decathlon|\bgo sport\b|\bintersport\b|salle de sport|basic fit|fitness|musee|parc |\bzoo\b|theatre|concert|ticketmaster|fnac spectacles/, "loisirs"],
  [/vinted|amazon|fnac|darty|boulanger|cdiscount|zara|h ?& ?m|\bkiabi\b|\bc ?& ?a\b|\bc et a\b|celio|jules\b|decathlon\.fr|action\b|\bikea\b|leroy merlin|castorama|bricorama|\bbrico|\bmaisons? du monde\b|ali ?express|shein|temu|veepee|zalando|\bgemo\b|chaussea|\bdomiciliation\b|ma-domiciliation/, "shopping"],
  [/booking|airbnb|hotel|ryanair|easyjet|air france|expedia|\bvoyage|camping|location vacances|\bgites?\b/, "vacances"],
  [/\bcadeau|fleuriste|interflora|\bcreation\b.*cadeau/, "cadeaux"],
];

export interface Categorized {
  category: string;
  /** « learned » = the family corrected this merchant before; « rule » = known merchant; « default » = no idea. */
  source: "learned" | "rule" | "default";
}

/** What the lines below say about the nature of the operation. */
function haystack(label: string, detail: string) {
  return stripAccents(`${label} ${detail}`).toLowerCase().replace(/[*_]/g, " ");
}

export function categorize(label: string, detail: string, learned: Map<string, string>): Categorized {
  const key = labelKey(label);
  const fromFamily = key ? learned.get(key) : undefined;
  if (fromFamily) return { category: fromFamily, source: "learned" };
  const text = haystack(label, detail);
  for (const [re, category] of RULES) if (re.test(text)) return { category, source: "rule" };
  return { category: "divers", source: "default" };
}

/**
 * True when the line looks like something that comes back every month at
 * about the same amount: a direct debit (« Prlv ») for a fixed expense, or a
 * rent transfer. Shopping and meals are never recurring in that sense.
 */
export function looksRecurring(kind: string, category: string, label: string, detail: string): boolean {
  const text = haystack(label, detail);
  if (/\bloyer\b/.test(text)) return true;
  const fixed = ["abonnements", "assurances", "énergie", "logement", "impôts"].includes(category);
  const debit = kind === "prlv" || kind === "prelevement";
  // Loans and bank fees are debited every month too.
  if (debit && /consumer finance|credit conso|\bpret\b|offre compte|cotisation carte|interets debiteurs/.test(text)) return true;
  return fixed && (debit || kind === "virement");
}
