// Comptes partagés (« Comptes ») : la répartition d'une dépense entre les
// participants d'un groupe, les soldes, et les remboursements qui équilibrent
// tout avec le moins de virements possible. Pur : les routes lisent la base.
//
// Tout est en centimes (entiers) : une dépense se partage au centime près et
// la somme des parts vaut toujours le montant exact.

export const SPLIT_MODES = ["equal", "percent", "amount", "shares"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

/**
 * Une ligne de partage, selon le mode :
 *   equal   value ignorée (1 pour chaque personne cochée) ;
 *   percent centièmes de pour cent (25 % = 2500), total 10 000 ;
 *   amount  centimes, total = montant ;
 *   shares  nombre de parts (2 pour un adulte, 1 pour un enfant…).
 */
export interface ShareInput {
  participantId: string;
  value: number;
}

export class SplitError extends Error {}

/** Répartit `total` au prorata de `weights` ; les centimes restants vont aux plus grands restes. */
function prorata(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
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

/** La part de chacun, en centimes ; la somme vaut exactement `amountCents`. */
export function computeShares(amountCents: number, mode: SplitMode, lines: ShareInput[]): { participantId: string; value: number; amountCents: number }[] {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new SplitError("Indique un montant.");
  const kept = lines.filter((l, i) => lines.findIndex((x) => x.participantId === l.participantId) === i);
  if (!kept.length) throw new SplitError("Choisis au moins une personne.");
  const values = kept.map((l) => (mode === "equal" ? 1 : l.value));
  if (values.some((v) => !Number.isInteger(v) || v < 0)) throw new SplitError("Une part n'est pas valable.");

  let amounts: number[];
  switch (mode) {
    case "equal":
      amounts = prorata(amountCents, values);
      break;
    case "percent": {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum !== 10_000) throw new SplitError(`Les pourcentages font ${(sum / 100).toLocaleString("fr-FR")} % au lieu de 100 %.`);
      amounts = prorata(amountCents, values);
      break;
    }
    case "amount": {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum !== amountCents) throw new SplitError(`Les montants font ${euros(sum)} au lieu de ${euros(amountCents)}.`);
      amounts = values;
      break;
    }
    case "shares": {
      if (values.reduce((a, b) => a + b, 0) === 0) throw new SplitError("Donne au moins une part.");
      amounts = prorata(amountCents, values);
      break;
    }
  }
  return kept.map((l, i) => ({ participantId: l.participantId, value: values[i], amountCents: amounts[i] }));
}

export function euros(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Solde de chacun : ce qu'il a payé moins ce qu'il doit (positif = on lui doit). */
export function balances(
  participantIds: string[],
  expenses: { paidById: string; amountCents: number; shares: { participantId: string; amountCents: number }[] }[],
): Map<string, number> {
  const out = new Map(participantIds.map((id) => [id, 0]));
  for (const e of expenses) {
    out.set(e.paidById, (out.get(e.paidById) ?? 0) + e.amountCents);
    for (const s of e.shares) out.set(s.participantId, (out.get(s.participantId) ?? 0) - s.amountCents);
  }
  return out;
}

/**
 * Les remboursements qui remettent tout le monde à zéro : à chaque fois, celui
 * qui doit le plus rembourse celui à qui on doit le plus. Au plus n − 1
 * virements pour n personnes.
 */
export function settleUp(bal: Map<string, number>): { fromId: string; toId: string; amountCents: number }[] {
  const debtors = [...bal].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const creditors = [...bal].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const out: { fromId: string; toId: string; amountCents: number }[] = [];
  const byDesc = (a: { v: number; id: string }, b: { v: number; id: string }) => b.v - a.v || a.id.localeCompare(b.id);
  while (debtors.length && creditors.length) {
    debtors.sort(byDesc);
    creditors.sort(byDesc);
    const d = debtors[0];
    const c = creditors[0];
    const amount = Math.min(d.v, c.v);
    out.push({ fromId: d.id, toId: c.id, amountCents: amount });
    d.v -= amount;
    c.v -= amount;
    if (d.v === 0) debtors.shift();
    if (c.v === 0) creditors.shift();
  }
  return out;
}
