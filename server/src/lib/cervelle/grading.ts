// Checking a typed answer before asking Claude: most right answers match the
// expected one once accents, case, articles and punctuation are ignored.

const ARTICLES = /^(le|la|les|l'|un|une|des|du|de la|de l'|the|a|an)\s*/;

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .trim()
    .replace(ARTICLES, "")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, small strings only. */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * true: clearly right. false: clearly wrong (empty). null: can't tell
 * locally, ask Claude.
 */
export function localGrade(answer: string, expected: string[]): boolean | null {
  const a = normalizeAnswer(answer);
  if (!a) return false;
  for (const e of expected) {
    const n = normalizeAnswer(e);
    if (!n) continue;
    if (a === n) return true;
    // One typo per 6 letters on words long enough to have typos.
    if (n.length >= 5 && distance(a, n) <= Math.floor(n.length / 6)) return true;
  }
  return null;
}

/** For « remettre dans l'ordre »: the child's order must be exactly the expected one. */
export function sameOrder(answer: string[], expected: string[]): boolean {
  return answer.length === expected.length && answer.every((x, i) => normalizeAnswer(x) === normalizeAnswer(expected[i]));
}
