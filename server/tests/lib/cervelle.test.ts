import { describe, expect, it } from "vitest";
import { applyAnswer, combinedMastery, displayedMastery, revisionProgress } from "../../src/lib/cervelle/mastery";
import { localGrade, normalizeAnswer, sameOrder } from "../../src/lib/cervelle/grading";
import { currentStreak, equip, levelOf, missions, nextStreak } from "../../src/lib/cervelle/game";
import { beforeParisDay, daysBetween, parisDay } from "../../src/lib/cervelle/days";
import { cleanQuestion } from "../../src/services/cervelleAi";

const DAY = 86_400_000;
const fresh = { mastery: "new", streak: 0, nextReviewAt: null, lastAnsweredAt: null };

describe("mastery", () => {
  it("needs right answers spread over time to reach « Maîtrisé »", () => {
    const t0 = new Date("2026-11-10T10:00:00Z");
    const a = applyAnswer(fresh, true, t0);
    expect(a).toMatchObject({ mastery: "new", streak: 1 });
    // Right again two minutes later: same sitting, still one.
    const b = applyAnswer(a, true, new Date(t0.getTime() + 2 * 60_000));
    expect(b.streak).toBe(1);
    const c = applyAnswer(b, true, new Date(t0.getTime() + DAY));
    expect(c).toMatchObject({ mastery: "mastered", streak: 2 });
    expect(c.nextReviewAt!.getTime() - t0.getTime()).toBe(DAY + 3 * DAY);
  });

  it("sends a notion back to « À revoir » on a mistake, and when its review is due", () => {
    const wrong = applyAnswer({ mastery: "mastered", streak: 4, nextReviewAt: null, lastAnsweredAt: null }, false);
    expect(wrong).toMatchObject({ mastery: "review", streak: 0 });
    const now = new Date();
    expect(displayedMastery({ mastery: "mastered", nextReviewAt: new Date(now.getTime() - 1) }, now)).toBe("review");
    expect(displayedMastery({ mastery: "mastered", nextReviewAt: new Date(now.getTime() + DAY) }, now)).toBe("mastered");
    expect(combinedMastery(["mastered", "review"])).toBe("review");
    expect(combinedMastery(["mastered", "mastered"])).toBe("mastered");
    expect(combinedMastery(["mastered", "new"])).toBe("new");
  });

  it("weights the steps and the mastered notions in the progress", () => {
    expect(revisionProgress({ sheetsRead: false, quizBest: null, examBest: null, mastered: 0, notions: 4 })).toBe(0);
    expect(revisionProgress({ sheetsRead: true, quizBest: 80, examBest: 70, mastered: 4, notions: 4 })).toBe(100);
  });
});

describe("grading", () => {
  it("ignores case, accents, articles and small typos", () => {
    expect(normalizeAnswer("  L'Égypte ! ")).toBe("egypte");
    expect(localGrade("la photosynthese", ["Photosynthèse"])).toBe(true);
    expect(localGrade("photosinthèse", ["photosynthèse"])).toBe(true);
    expect(localGrade("", ["x"])).toBe(false);
    expect(localGrade("la respiration", ["photosynthèse"])).toBeNull();
    expect(sameOrder(["a", "b"], ["A", "b"])).toBe(true);
    expect(sameOrder(["b", "a"], ["a", "b"])).toBe(false);
  });
});

describe("game", () => {
  it("counts study days in a row in Paris time", () => {
    expect(nextStreak(null, 0, "2026-11-14")).toBe(1);
    expect(nextStreak("2026-11-13", 4, "2026-11-14")).toBe(5);
    expect(nextStreak("2026-11-14", 5, "2026-11-14")).toBe(5);
    expect(nextStreak("2026-11-10", 5, "2026-11-14")).toBe(1);
    expect(currentStreak("2026-11-12", 5, "2026-11-14")).toBe(0);
    expect(parisDay(new Date("2026-11-14T23:30:00Z"))).toBe("2026-11-15");
    expect(daysBetween("2026-11-14", "2026-11-15")).toBe(1);
    expect(beforeParisDay("2026-11-15").getTime()).toBeLessThan(Date.parse("2026-11-14T23:00:00Z"));
  });

  it("grows the mascot, fills one accessory per slot and counts missions", () => {
    expect(levelOf(0)).toMatchObject({ level: 1, nextLevelXp: 100 });
    expect(levelOf(650)).toMatchObject({ level: 4, name: "Cervelle futée" });
    expect(levelOf(99_999).nextLevelXp).toBeNull();
    expect(equip(["casquette", "lunettes"], "couronne")).toEqual(["lunettes", "couronne"]);
    expect(missions([{ mode: "fiches", correct: 0, total: 0 }, { mode: "qcm", correct: 5, total: 10 }], 15).done).toBe(2);
  });
});

describe("cleanQuestion", () => {
  const base = { enonce: "Q ?", choix: [], reponse: "", reponses_acceptees: [], elements: [], explication: "" };
  it("drops questions that can't be played", () => {
    expect(cleanQuestion({ ...base, type: "qcm", choix: ["a", "b"], reponse: "2" })).toBeNull();
    expect(cleanQuestion({ ...base, type: "qcm", choix: ["a", "b"], reponse: "1" })).toMatchObject({ answer: "1" });
    expect(cleanQuestion({ ...base, type: "vrai_faux", reponse: "Peut-être" })).toBeNull();
    expect(cleanQuestion({ ...base, type: "trous", reponse: "x" })).toBeNull();
    expect(cleanQuestion({ ...base, type: "trous", enonce: "Le ___ brille.", reponse: "soleil" })).toMatchObject({ answer: "soleil" });
    expect(cleanQuestion({ ...base, type: "ordre", elements: ["a", "b"] })).toBeNull();
  });
});

import { PROGRAMMES, chapterById, programmeKey } from "../../src/lib/cervelle/programme";

describe("programme", () => {
  it("recognises how families write the class", () => {
    expect(programmeKey("CM2")).toBe("CM2");
    expect(programmeKey("5ème")).toBe("5e");
    expect(programmeKey("5e")).toBe("5e");
    expect(programmeKey("4e")).toBeNull();
  });
  it("has unique chapter ids", () => {
    const ids = Object.values(PROGRAMMES).flatMap((subjects) => subjects.flatMap((s) => s.chapters.map((c) => c.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(chapterById("cm2-hi-republique")?.grade).toBe("CM2");
  });
});
