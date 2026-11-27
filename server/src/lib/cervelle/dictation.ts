// Dictée : on compare ce que l'enfant a écrit à la phrase dictée, mot à mot.
// La ponctuation et les majuscules ne comptent pas ; les accents, si (c'est
// de l'orthographe). Le résultat n'est pas une note : la liste des mots à
// revoir, et la phrase avec ces mots repérés.

export const DICTATION_STARS = 2;
export const MAX_WORDS = 20;

export interface DictationSentence {
  text: string;
  typed: string | null;
  missed: string[];
}

/** Les mots d'une phrase, dans l'ordre. « l'école » donne « l' » et « école ». */
export function tokens(text: string): string[] {
  return (
    text
      .normalize("NFC")
      .replace(/[’`]/g, "'")
      .match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*'?/gu) ?? []
  );
}

const norm = (w: string) => w.toLocaleLowerCase("fr");

/**
 * Les mots de la phrase attendue que l'enfant n'a pas écrits correctement :
 * on aligne les deux suites de mots (plus longue sous-suite commune) et on
 * garde les mots attendus qui ne sont pas alignés.
 */
export function missedWords(expected: string, typed: string): { word: string; index: number }[] {
  const a = tokens(expected);
  const b = tokens(typed).map(norm);
  const an = a.map(norm);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = an[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: { word: string; index: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length) {
    if (j < b.length && an[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && lcs[i][j + 1] >= lcs[i + 1][j]) {
      j++;
    } else {
      out.push({ word: a[i], index: i });
      i++;
    }
  }
  return out;
}

/** Les mots de la liste, nettoyés : un par ligne ou séparés par des virgules. */
export function cleanWords(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw.flatMap((x) => x.split(/[,;\n]/))) {
    const word = w.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!word || seen.has(norm(word))) continue;
    seen.add(norm(word));
    out.push(word);
  }
  return out.slice(0, MAX_WORDS);
}

/** Tous les mots à revoir de la dictée, sans doublon. */
export function wordsToReview(sentences: DictationSentence[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of sentences) {
    for (const w of s.missed) {
      if (seen.has(norm(w))) continue;
      seen.add(norm(w));
      out.push(w);
    }
  }
  return out;
}
