import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../env";

// « Sorties & idées » : la météo du jour choisi (Open-Meteo, gratuit, sans
// clé) et 5 idées d'activités en famille proposées par Claude, selon la
// météo, le temps libre du planning et l'âge des enfants (jamais leurs noms).

export class OutingsError extends Error {}

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

export interface DayWeather {
  /** Code WMO de la journée. */
  code: number;
  label: string;
  emoji: string;
  tMin: number;
  tMax: number;
  /** Probabilité de pluie maximale (%). */
  rain: number;
}

type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
let fetcher: FetchLike = (url) => fetch(url);
/** Tests : remplace l'accès réseau. */
export function setOutingsFetch(f: FetchLike) {
  fetcher = f;
}

const WMO: [number[], string, string][] = [
  [[0], "Grand soleil", "☀️"],
  [[1, 2], "Éclaircies", "🌤️"],
  [[3], "Nuageux", "☁️"],
  [[45, 48], "Brouillard", "🌫️"],
  [[51, 53, 55, 56, 57], "Bruine", "🌦️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Pluie", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Neige", "❄️"],
  [[95, 96, 99], "Orage", "⛈️"],
];

export function describeWeather(code: number): { label: string; emoji: string } {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], emoji: hit[2] } : { label: "Temps variable", emoji: "🌥️" };
}

export async function geocode(city: string): Promise<Place | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&format=json&name=${encodeURIComponent(city)}`;
  const res = await fetcher(url).catch(() => null);
  if (!res?.ok) throw new OutingsError("La météo ne répond pas pour le moment. Réessaie dans un instant.");
  const data = (await res.json()) as { results?: { name: string; latitude: number; longitude: number }[] };
  const r = data.results?.[0];
  return r ? { name: r.name, latitude: r.latitude, longitude: r.longitude } : null;
}

/** La météo de `day` (« AAAA-MM-JJ », jusqu'à 15 jours). */
export async function weatherOn(place: Place, day: string): Promise<DayWeather | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FParis&start_date=${day}&end_date=${day}`;
  const res = await fetcher(url).catch(() => null);
  if (!res?.ok) return null;
  const d = ((await res.json()) as { daily?: { weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: (number | null)[] } }).daily;
  if (!d?.weather_code?.length) return null;
  const code = d.weather_code[0];
  return { code, ...describeWeather(code), tMin: Math.round(d.temperature_2m_min?.[0] ?? 0), tMax: Math.round(d.temperature_2m_max?.[0] ?? 0), rain: d.precipitation_probability_max?.[0] ?? 0 };
}

export const IdeaSchema = z.object({
  ideas: z
    .array(
      z.object({
        emoji: z.string().describe("Un seul emoji"),
        title: z.string().describe("Titre court, 2 à 6 mots"),
        description: z.string().describe("Une ou deux phrases simples : quoi faire, et pourquoi c'est sympa"),
        place: z.enum(["dedans", "dehors"]),
        cost: z.enum(["gratuit", "€", "€€"]),
        minutes: z.number().int().describe("Durée en minutes"),
        start: z.string().describe("Heure de début conseillée « HH:MM »"),
      }),
    )
    .describe("Exactement 5 idées variées"),
});
export type Idea = z.infer<typeof IdeaSchema>["ideas"][number];

export interface IdeasContext {
  dayLabel: string;
  moment: "soir" | "journee";
  city: string | null;
  weather: DayWeather | null;
  /** Âges des membres (sans noms) ; null quand inconnu. */
  ages: (number | null)[];
  /** Ce qui est déjà prévu ce jour-là : « 10:00-11:00 Piscine ». */
  busy: string[];
  /** Idées déjà proposées (pour ne pas les redonner). */
  exclude: string[];
}

const SYSTEM = `Tu aides une famille française à trouver quoi faire ensemble. Tu proposes des activités simples, réalistes et peu chères, adaptées à la météo, à l'âge des enfants et au temps libre. Varie : une sortie, un jeu, une activité créative ou de cuisine, quelque chose de calme. Si la pluie est probable ou s'il fait froid, privilégie le dedans. Le soir (après 18 h), propose des idées à la maison ou très proches, courtes (30 à 90 minutes). Ne cite pas de lieu précis inventé : reste général (« un parc près de chez vous », « la médiathèque »). Écris en français, phrases courtes.`;

export function buildPrompt(c: IdeasContext): string {
  const w = c.weather ? `${c.weather.label}, ${c.weather.tMin} à ${c.weather.tMax} °C, risque de pluie ${c.weather.rain} %` : "météo inconnue";
  const kids = c.ages.filter((a): a is number => a !== null && a < 18).sort((a, b) => a - b);
  const adults = c.ages.filter((a) => a === null || a >= 18).length;
  return [
    `Quand : ${c.dayLabel} (${c.moment === "soir" ? "en soirée, après 18 h" : "dans la journée"}).`,
    c.city ? `Ville : ${c.city}.` : "",
    `Météo : ${w}.`,
    `Famille : ${adults} adulte(s)${kids.length ? `, enfants de ${kids.join(", ")} ans` : ""}.`,
    c.busy.length ? `Déjà prévu ce jour-là (éviter ces créneaux) : ${c.busy.join(" ; ")}.` : "Rien de prévu ce jour-là.",
    c.exclude.length ? `Déjà proposé, à ne pas redonner : ${c.exclude.join(" ; ")}.` : "",
    "Propose 5 idées.",
  ]
    .filter(Boolean)
    .join("\n");
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

type Proposer = (c: IdeasContext) => Promise<Idea[]>;
let proposer: Proposer = async (c) => {
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(IdeaSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: buildPrompt(c) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new OutingsError("Trop de demandes, réessaie dans une minute.");
    if (e instanceof Anthropic.APIError) throw new OutingsError("Les idées ne sont pas disponibles pour le moment.");
    throw e;
  }
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new OutingsError("Pas d'idée cette fois-ci. Réessaie.");
  return response.parsed_output.ideas;
};
/** Tests : remplace l'appel à Claude. */
export function setOutingsProposer(p: Proposer) {
  proposer = p;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function proposeIdeas(c: IdeasContext): Promise<Idea[]> {
  const ideas = await proposer(c);
  return ideas.slice(0, 5).map((i) => ({
    ...i,
    title: i.title.trim().slice(0, 60),
    description: i.description.trim().slice(0, 300),
    emoji: [...i.emoji.trim()].slice(0, 2).join("") || "✨",
    minutes: Math.min(480, Math.max(15, Math.round(i.minutes / 15) * 15)),
    start: HHMM.test(i.start) ? i.start : c.moment === "soir" ? "19:00" : "14:00",
  }));
}
