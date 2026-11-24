import type { SplitGroup, SplitMode, SplitParticipant } from "../api/types";
import { formatEuros } from "./money";

// Comptes partagés, côté appli : retrouver « moi » dans un groupe, résumer
// où j'en suis, et prévisualiser la part de chacun pendant la saisie.

export const GROUP_EMOJIS = ["💸", "👨‍👩‍👧", "🏖️", "⛷️", "🏠", "🎒", "🍕", "🎁", "🚗", "⚽"];

export const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  equal: "À parts égales",
  percent: "En %",
  amount: "En montants",
  shares: "En parts",
};

/** Moi dans un groupe : mon prénom (premier mot du nom du compte), ou mon membre pour un compte enfant. */
export function findMe(participants: SplitParticipant[], me: { name?: string; memberId?: string | null } | null | undefined): SplitParticipant | null {
  if (!me) return null;
  if (me.memberId) {
    const byMember = participants.find((p) => p.memberId === me.memberId);
    if (byMember) return byMember;
  }
  const first = me.name?.trim().split(/\s+/)[0]?.toLocaleLowerCase("fr-FR");
  if (!first) return null;
  return participants.find((p) => p.name.trim().toLocaleLowerCase("fr-FR") === first || p.name.trim().toLocaleLowerCase("fr-FR").split(/\s+/)[0] === first) ?? null;
}

/** Une ligne de résumé pour la liste des groupes. */
export function mySide(g: SplitGroup, me?: { name?: string; memberId?: string | null } | null): { text: string; tone: "plus" | "minus" | "even" } {
  const mine = findMe(g.participants, me);
  if (mine) {
    const cents = g.balances.find((b) => b.participantId === mine.id)?.cents ?? 0;
    if (cents > 0) return { text: `On te doit ${formatEuros(cents)}`, tone: "plus" };
    if (cents < 0) return { text: `Tu dois ${formatEuros(-cents)}`, tone: "minus" };
    return { text: "Tu es à l'équilibre", tone: "even" };
  }
  if (!g.transfers.length) return { text: "Tout le monde est à l'équilibre", tone: "even" };
  const t = g.transfers[0];
  const name = (id: string) => g.participants.find((p) => p.id === id)?.name ?? "?";
  const more = g.transfers.length > 1 ? ` (+${g.transfers.length - 1})` : "";
  return { text: `${name(t.fromId)} doit ${formatEuros(t.amountCents)} à ${name(t.toId)}${more}`, tone: "even" };
}

/** Répartit `total` au prorata de `weights` (même règle que le serveur). */
function prorata(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}

/**
 * La part de chacun pendant la saisie, et ce qui ne va pas encore (le total
 * des pourcentages ou des montants). `values` : saisies par personne cochée.
 */
export function previewShares(amountCents: number, mode: SplitMode, values: number[]): { amounts: number[]; problem: string | null } {
  if (!values.length) return { amounts: [], problem: "Choisis au moins une personne." };
  const sum = values.reduce((a, b) => a + b, 0);
  switch (mode) {
    case "equal":
      return { amounts: prorata(amountCents, values.map(() => 1)), problem: null };
    case "percent":
      return { amounts: prorata(amountCents, values), problem: sum === 10_000 ? null : `Les pourcentages font ${(sum / 100).toLocaleString("fr-FR")} % au lieu de 100 %.` };
    case "amount":
      return { amounts: values, problem: sum === amountCents ? null : `Les montants font ${formatEuros(sum)} au lieu de ${formatEuros(amountCents)}.` };
    case "shares":
      return { amounts: prorata(amountCents, values), problem: sum > 0 ? null : "Donne au moins une part." };
  }
}
