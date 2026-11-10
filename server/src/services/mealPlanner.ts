import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z4 from "zod/v4";
import { env } from "../env";

// Weekly menu suggestions. The app asks the family a few questions
// (régime, temps de cuisine, envies…), then Claude proposes a dish for each
// empty slot. Nothing is saved here: the app shows the proposal, lets the user
// re-roll single slots, then saves through POST /meals/bulk.

export const MEAL_TYPES = ["petit-déjeuner", "déjeuner", "goûter", "dîner"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const DIETS = ["végétarien", "pescetarien", "sans-porc", "halal", "sans-gluten", "sans-lactose"] as const;
export const COOK_TIMES = ["express", "normal", "élaboré"] as const;
export const RECIPE_USAGE = ["souvent", "parfois", "jamais"] as const;

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const COOK_TIME_LABEL: Record<(typeof COOK_TIMES)[number], string> = {
  express: "rapide, moins de 20-30 min de préparation",
  normal: "normal, 30 à 45 min",
  élaboré: "on a le temps, plats mijotés ou plus élaborés acceptés",
};

export interface Slot {
  weekday: number;
  type: MealType;
}

export interface PlannerPreferences {
  diets: (typeof DIETS)[number][];
  allergies: string;
  weekdayTime: (typeof COOK_TIMES)[number];
  weekendTime: (typeof COOK_TIMES)[number];
  fishPerWeek: number | null;
  veggiePerWeek: number | null;
  useMyRecipes: (typeof RECIPE_USAGE)[number];
  wishes: string;
  avoid: string;
}

export interface PlannerContext {
  slots: Slot[];
  preferences: PlannerPreferences;
  recipes: { id: string; title: string }[];
  members: { name: string; age: number | null }[];
  /** Meals that stay in the week (not regenerated) — for variety. */
  keptMeals: { weekday: number; type: string; title: string }[];
  /** Dishes the user just rejected or already sees elsewhere in the proposal. */
  exclude: string[];
}

export interface ProposedMeal {
  weekday: number;
  type: MealType;
  title: string;
  recipeId: string | null;
  notes: string;
}

const ProposalSchema = z4.object({
  meals: z4.array(
    z4.object({
      weekday: z4.number().int().describe("0 = lundi … 6 = dimanche"),
      type: z4.enum(MEAL_TYPES),
      title: z4.string().describe("Nom du plat, court, en français"),
      recipeId: z4.string().nullable().describe("id d'une recette de la famille si le plat en vient, sinon null"),
      notes: z4.string().describe("Une ligne utile (accompagnement, astuce, à préparer la veille) ou chaîne vide"),
    }),
  ),
});

const SYSTEM_PROMPT = `Tu es l'assistant « menus » d'une appli de planning familial française.
Tu proposes des repas du quotidien, réalistes pour une famille : plats que l'on cuisine vraiment à la maison en France, ingrédients de supermarché, de saison.

Règles :
- Remplis exactement les créneaux demandés, un plat par créneau, ni plus ni moins.
- Respecte strictement les régimes et allergies : un seul écart rend la proposition inutilisable.
- Respecte le temps de cuisine indiqué (semaine vs week-end).
- Varie : pas deux fois le même plat dans la semaine, alterne les féculents, les protéines et les cuisines ; évite de répéter un plat déjà prévu ou à exclure.
- Petit-déjeuner et goûter restent simples (pas de vraie cuisine en semaine).
- Pense aux enfants s'il y en a : plats qu'ils mangent volontiers, sans tomber dans les nuggets tous les jours.
- Quand tu reprends une recette de la famille, mets son id dans recipeId et son titre exact dans title. Sinon recipeId = null.
- Titres courts (« Gratin de courgettes », pas une phrase). Notes : une ligne au plus, ou vide.`;

function describePreferences(p: PlannerPreferences): string {
  const lines: string[] = [];
  lines.push(`Régimes : ${p.diets.length ? p.diets.join(", ") : "aucun"}`);
  lines.push(`Allergies / intolérances : ${p.allergies.trim() || "aucune"}`);
  lines.push(`Temps de cuisine en semaine : ${COOK_TIME_LABEL[p.weekdayTime]}`);
  lines.push(`Temps de cuisine le week-end : ${COOK_TIME_LABEL[p.weekendTime]}`);
  if (p.fishPerWeek !== null) lines.push(`Repas avec poisson souhaités sur la semaine : ${p.fishPerWeek}`);
  if (p.veggiePerWeek !== null) lines.push(`Repas végétariens souhaités sur la semaine : ${p.veggiePerWeek}`);
  const usage = { souvent: "en priorité, dès que ça colle", parfois: "de temps en temps", jamais: "ne pas les utiliser" };
  lines.push(`Utiliser les recettes de la famille : ${usage[p.useMyRecipes]}`);
  if (p.wishes.trim()) lines.push(`Envies : ${p.wishes.trim()}`);
  if (p.avoid.trim()) lines.push(`À éviter : ${p.avoid.trim()}`);
  return lines.join("\n");
}

export function buildUserPrompt(ctx: PlannerContext): string {
  const family = ctx.members.length
    ? ctx.members.map((m) => (m.age !== null ? `${m.name} (${m.age} ans)` : m.name)).join(", ")
    : "non renseignée";
  const recipes =
    ctx.preferences.useMyRecipes === "jamais" || ctx.recipes.length === 0
      ? "aucune"
      : ctx.recipes.map((r) => `- [${r.id}] ${r.title}`).join("\n");
  const kept = ctx.keptMeals.length
    ? ctx.keptMeals.map((m) => `- ${WEEKDAYS[m.weekday]} ${m.type} : ${m.title}`).join("\n")
    : "aucun";
  const slots = ctx.slots.map((s) => `- weekday ${s.weekday} (${WEEKDAYS[s.weekday]}) · ${s.type}`).join("\n");

  return `<famille>${family}</famille>

<preferences>
${describePreferences(ctx.preferences)}
</preferences>

<recettes_de_la_famille>
${recipes}
</recettes_de_la_famille>

<deja_prevus>
${kept}
</deja_prevus>
${ctx.exclude.length ? `\n<a_exclure>\n${ctx.exclude.map((t) => `- ${t}`).join("\n")}\n</a_exclure>\n` : ""}
Propose un plat pour chacun de ces créneaux :
${slots}`;
}

/**
 * Keeps only what was asked for: one meal per requested slot, recipe ids that
 * really belong to the family. Slots the model skipped are simply absent.
 */
export function sanitizeProposal(
  raw: { weekday: number; type: string; title: string; recipeId: string | null; notes: string }[],
  slots: Slot[],
  recipes: { id: string; title: string }[],
): ProposedMeal[] {
  const wanted = new Set(slots.map((s) => `${s.weekday}|${s.type}`));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: ProposedMeal[] = [];
  for (const m of raw) {
    const key = `${m.weekday}|${m.type}`;
    if (!wanted.has(key) || seen.has(key)) continue;
    const recipe = m.recipeId ? recipeById.get(m.recipeId) : undefined;
    const title = (recipe?.title ?? m.title).trim();
    if (!title) continue;
    seen.add(key);
    out.push({
      weekday: m.weekday,
      type: m.type as MealType,
      title,
      recipeId: recipe?.id ?? null,
      notes: m.notes.trim(),
    });
  }
  return out.sort((a, b) => a.weekday - b.weekday || MEAL_TYPES.indexOf(a.type) - MEAL_TYPES.indexOf(b.type));
}

export class MealPlannerError extends Error {}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

export async function proposeMeals(ctx: PlannerContext): Promise<ProposedMeal[]> {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // A week of menus is light reasoning; low effort keeps the wait short on mobile.
      output_config: { effort: "low", format: betaZodOutputFormat(ProposalSchema) },
      // If the main model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new MealPlannerError("Trop de demandes, réessaie dans une minute.");
    if (e instanceof Anthropic.AuthenticationError) throw new MealPlannerError("Clé API Claude invalide côté serveur.");
    if (e instanceof Anthropic.APIError) throw new MealPlannerError("Le service de menus est indisponible pour le moment.");
    throw e;
  }

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new MealPlannerError("Impossible de générer des menus avec ces réponses. Essaie de reformuler tes envies.");
  }
  return sanitizeProposal(response.parsed_output.meals, ctx.slots, ctx.recipes);
}
