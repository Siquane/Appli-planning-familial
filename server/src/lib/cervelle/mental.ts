import crypto from "node:crypto";

// Calcul mental : des séries courtes de 10 calculs. Le niveau part de la
// classe de l'enfant et monte tout seul quand il réussit bien plusieurs
// séries de suite ; il ne redescend jamais tout seul (un parent peut le
// changer). On compare l'enfant à lui-même : son record de temps au niveau.

export const RUN_SIZE = 10;
export const MAX_LEVEL = 8;
export const MENTAL_STARS = 1;
/** Séries réussies d'affilée (9/10 au moins) pour monter d'un niveau. */
export const LEVEL_UP_RUNS = 3;
export const LEVEL_UP_SCORE = 9;

export const LEVELS: { level: number; label: string }[] = [
  { level: 1, label: "Additions jusqu'à 10" },
  { level: 2, label: "Additions et soustractions jusqu'à 20" },
  { level: 3, label: "Jusqu'à 100, tables de 2, 3, 4 et 5" },
  { level: 4, label: "Toutes les tables de multiplication" },
  { level: 5, label: "Tables et divisions, nombres jusqu'à 1 000" },
  { level: 6, label: "× 10, × 100, doubles et moitiés" },
  { level: 7, label: "Nombres à virgule et pourcentages simples" },
  { level: 8, label: "Nombres négatifs, carrés et priorités" },
];

export interface MentalProblem {
  id: string;
  prompt: string;
  answer: number;
}

/** Le niveau de départ d'après la classe écrite par la famille. */
export function levelForGrade(grade: string, level: string): number {
  const g = grade.toLowerCase().replace(/\s+/g, "");
  if (/^cp/.test(g)) return 1;
  if (/^ce1/.test(g)) return 2;
  if (/^ce2/.test(g)) return 3;
  if (/^cm1/.test(g)) return 4;
  if (/^cm2/.test(g)) return 5;
  if (/^6/.test(g)) return 6;
  if (/^5/.test(g)) return 7;
  if (/^[43]/.test(g)) return 8;
  if (level === "primaire") return 3;
  if (level === "college") return 6;
  return 8;
}

type Rng = (min: number, max: number) => number;
/** Entier entre min et max compris. */
const cryptoRng: Rng = (min, max) => crypto.randomInt(min, max + 1);

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

function table(rng: Rng, tables: number[]): MentalProblem | null {
  if (!tables.length) return null;
  const t = tables[rng(0, tables.length - 1)];
  const k = rng(2, 10);
  return rng(0, 3) === 0 ? { id: "", prompt: `${t * k} ÷ ${t}`, answer: k } : { id: "", prompt: rng(0, 1) ? `${t} × ${k}` : `${k} × ${t}`, answer: t * k };
}

function problemAt(level: number, rng: Rng): MentalProblem {
  const p = (prompt: string, answer: number): MentalProblem => ({ id: "", prompt, answer });
  switch (level) {
    case 1: {
      const a = rng(1, 9);
      const b = rng(1, 10 - a);
      return p(`${a} + ${b}`, a + b);
    }
    case 2: {
      if (rng(0, 1)) {
        const a = rng(2, 18);
        const b = rng(1, 20 - a);
        return p(`${a} + ${b}`, a + b);
      }
      const a = rng(5, 20);
      const b = rng(1, a);
      return p(`${a} − ${b}`, a - b);
    }
    case 3: {
      const kind = rng(0, 2);
      if (kind === 0) return table(rng, [2, 3, 4, 5])!;
      const a = rng(10, 89);
      if (kind === 1) {
        const b = rng(2, 99 - a);
        return p(`${a} + ${b}`, a + b);
      }
      const b = rng(2, a - 1);
      return p(`${a} − ${b}`, a - b);
    }
    case 4: {
      if (rng(0, 2)) return table(rng, [2, 3, 4, 5, 6, 7, 8, 9])!;
      const a = rng(20, 99);
      const b = rng(11, 99);
      return rng(0, 1) ? p(`${a} + ${b}`, a + b) : p(`${a + b} − ${b}`, a);
    }
    case 5: {
      const kind = rng(0, 3);
      if (kind <= 1) {
        const t = rng(2, 9);
        const k = rng(2, 10);
        return kind === 0 ? p(`${t} × ${k}`, t * k) : p(`${t * k} ÷ ${t}`, k);
      }
      const a = rng(1, 9) * 100 + rng(0, 9) * 10;
      const b = rng(1, 4) * 100 + rng(0, 9) * 10;
      return kind === 2 ? p(`${a} + ${b}`, a + b) : p(`${a + b} − ${b}`, a);
    }
    case 6: {
      const kind = rng(0, 4);
      const n = rng(2, 99);
      if (kind === 0) return p(`${n} × 10`, n * 10);
      if (kind === 1) return p(`${n} × 100`, n * 100);
      if (kind === 2) return p(`Le double de ${n}`, n * 2);
      if (kind === 3) {
        const e = rng(5, 99) * 2;
        return p(`La moitié de ${e}`, e / 2);
      }
      const a = rng(11, 29);
      const b = rng(2, 9);
      return p(`${a} × ${b}`, a * b);
    }
    case 7: {
      const kind = rng(0, 3);
      if (kind === 0) {
        const a = rng(1, 50) / 10;
        const b = rng(1, 50) / 10;
        return p(`${fmt(a)} + ${fmt(b)}`, Math.round((a + b) * 10) / 10);
      }
      if (kind === 1) {
        const a = rng(1, 99) / 10;
        return p(`${fmt(a)} × 10`, Math.round(a * 100) / 10);
      }
      if (kind === 2) {
        const pct = [10, 25, 50][rng(0, 2)];
        const base = pct === 25 ? rng(1, 20) * 4 : pct === 50 ? rng(1, 50) * 2 : rng(1, 20) * 10;
        return p(`${pct} % de ${base}`, (base * pct) / 100);
      }
      const n = rng(1, 30) * 2;
      return p(`${n} × 0,5`, n / 2);
    }
    default: {
      const kind = rng(0, 3);
      if (kind === 0) {
        const a = rng(-15, 15);
        const b = rng(1, 20);
        return p(`${a} − ${b}`, a - b);
      }
      if (kind === 1) {
        const a = rng(-12, -1);
        const b = rng(1, 20);
        return p(`${a} + ${b}`, a + b);
      }
      if (kind === 2) {
        const n = rng(2, 15);
        return p(`${n}²`, n * n);
      }
      const a = rng(2, 9);
      const b = rng(2, 9);
      const c = rng(2, 9);
      return p(`${a} + ${b} × ${c}`, a + b * c);
    }
  }
}

/** Une série : 10 calculs du niveau, la moitié sur les tables visées par un parent. */
export function makeRun(level: number, tables: number[] = [], rng: Rng = cryptoRng): MentalProblem[] {
  const lvl = Math.min(MAX_LEVEL, Math.max(1, level));
  const out: MentalProblem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < RUN_SIZE && guard++ < 200) {
    const fromTables = tables.length > 0 && out.length % 2 === 1 ? table(rng, tables) : null;
    const q = fromTables ?? problemAt(lvl, rng);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    out.push({ ...q, id: `m${out.length}` });
  }
  return out;
}

/** La réponse tapée par l'enfant est-elle juste ? (« 2,5 » ou « 2.5 », espaces permis.) */
export function isRight(typed: string, answer: number): boolean {
  const t = typed.replace(/\s/g, "").replace(",", ".").replace("−", "-");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return false;
  return Math.abs(Number(t) - answer) < 1e-9;
}

/** Après une série : le niveau monte si les dernières séries du niveau sont toutes réussies. */
export function nextLevel(level: number, recentAtLevel: { correct: number; total: number }[]): number {
  if (level >= MAX_LEVEL) return MAX_LEVEL;
  const last = recentAtLevel.slice(0, LEVEL_UP_RUNS);
  if (last.length < LEVEL_UP_RUNS) return level;
  return last.every((r) => r.total >= RUN_SIZE && r.correct >= LEVEL_UP_SCORE) ? level + 1 : level;
}
