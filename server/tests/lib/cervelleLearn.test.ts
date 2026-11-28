import { describe, expect, it } from "vitest";
import { cleanWords, missedWords, tokens, wordsToReview } from "../../src/lib/cervelle/dictation";
import { isRight, levelForGrade, makeRun, nextLevel, RUN_SIZE } from "../../src/lib/cervelle/mental";

describe("dictée", () => {
  it("splits words, keeps elisions and hyphens", () => {
    expect(tokens("L'école, c'est arc-en-ciel !")).toEqual(["L'", "école", "c'", "est", "arc-en-ciel"]);
  });
  it("finds the words written wrong, ignoring case and punctuation but not accents", () => {
    expect(missedWords("Le chat mange la souris.", "le chat mange la souris")).toEqual([]);
    expect(missedWords("Le château est très grand.", "Le chateau est trés grand").map((m) => m.word)).toEqual(["château", "très"]);
    expect(missedWords("Il marche vite dans la rue.", "Il marche dans la rue").map((m) => m.word)).toEqual(["vite"]);
    expect(missedWords("Elle a deux chats.", "").map((m) => m.word)).toEqual(["Elle", "a", "deux", "chats"]);
  });
  it("cleans the word list and the words to review", () => {
    expect(cleanWords(["maison, Maison", "  jardin \n", ""])).toEqual(["maison", "jardin"]);
    expect(wordsToReview([{ text: "", typed: "", missed: ["été", "car"] }, { text: "", typed: "", missed: ["Été"] }])).toEqual(["été", "car"]);
  });
});

describe("calcul mental", () => {
  it("starts from the class", () => {
    expect(levelForGrade("CE2", "primaire")).toBe(3);
    expect(levelForGrade("6e", "college")).toBe(6);
    expect(levelForGrade("", "primaire")).toBe(3);
  });
  it("makes 10 different problems with right answers, half on the chosen tables", () => {
    for (let level = 1; level <= 8; level++) {
      const run = makeRun(level);
      expect(run).toHaveLength(RUN_SIZE);
      expect(new Set(run.map((p) => p.prompt)).size).toBe(RUN_SIZE);
      for (const p of run) expect(Number.isFinite(p.answer)).toBe(true);
    }
    const run = makeRun(2, [7]);
    expect(run.filter((p) => /7 × |× 7| ÷ 7/.test(p.prompt)).length).toBeGreaterThanOrEqual(5);
    for (const p of run.filter((q) => / × 7$/.test(q.prompt))) expect(p.answer % 7).toBe(0);
  });
  it("checks typed answers", () => {
    expect(isRight("2,5", 2.5)).toBe(true);
    expect(isRight(" 42 ", 42)).toBe(true);
    expect(isRight("-3", -3)).toBe(true);
    expect(isRight("4", 5)).toBe(false);
    expect(isRight("", 0)).toBe(false);
  });
  it("goes up after 3 good runs in a row, never down", () => {
    const good = { correct: 9, total: 10 };
    expect(nextLevel(3, [good, good])).toBe(3);
    expect(nextLevel(3, [good, good, good])).toBe(4);
    expect(nextLevel(3, [good, { correct: 5, total: 10 }, good])).toBe(3);
    expect(nextLevel(8, [good, good, good])).toBe(8);
  });
});
