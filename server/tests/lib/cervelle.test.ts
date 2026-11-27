import { describe, expect, it } from "vitest";
import { applyAnswer, combinedMastery, displayedMastery, revisionProgress } from "../../src/lib/cervelle/mastery";
import { localGrade, normalizeAnswer, sameOrder } from "../../src/lib/cervelle/grading";
import { challengeWinner, currentStreak, equip, focusReward, levelOf, makeFriendCode, missions, nextStreak, timerDefaults } from "../../src/lib/cervelle/game";
import { beforeParisDay, daysBetween, mondayOf, parisDay, weekdayOf } from "../../src/lib/cervelle/days";
import { cleanQuestion, cleanSlots } from "../../src/services/cervelleAi";

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
  });

  it("picks three daily missions that change with the day, never one the child can't do", () => {
    const ctx = {
      sessions: [{ mode: "fiches", correct: 0, total: 0 }, { mode: "qcm", correct: 7, total: 10 }],
      answersToday: 15,
      focusMinutes: 0,
      habitsChecked: 0,
      habitsPlanned: 0,
      todosDoneToday: 0,
      todosAddedToday: 0,
      todosOpen: 0,
      journalToday: false,
      hasRevisions: true,
      focusTarget: 25,
    };
    const a = missions(ctx, "learner:2026-11-16");
    expect(a.total).toBe(3);
    expect(a.list[0].done).toBe(true);
    expect(a.list[1]).toMatchObject({ id: "minuteur", label: "Travailler 25 min avec le minuteur", done: false, progress: "0/25 min" });
    expect(["planifier", "journal"]).toContain(a.list[2].id);
    // Same day, same missions; other days, other picks.
    expect(missions(ctx, "learner:2026-11-16").list.map((m) => m.id)).toEqual(a.list.map((m) => m.id));
    const week = new Set(Array.from({ length: 14 }, (_, i) => missions({ ...ctx, habitsPlanned: 3, todosOpen: 2 }, `learner:day${i}`).list.map((m) => m.id).join()));
    expect(week.size).toBeGreaterThan(1);
    // No revision yet: no revision mission.
    expect(missions({ ...ctx, hasRevisions: false }, "x").list.map((m) => m.id)).not.toContain("quiz");
  });

  it("pays the timer by the minute, under a daily cap", () => {
    expect(focusReward(4 * 60, 0)).toEqual({ coins: 0, xp: 0, minutes: 0 });
    expect(focusReward(25 * 60, 0)).toEqual({ coins: 5, xp: 50, minutes: 25 });
    expect(focusReward(25 * 60, 170)).toEqual({ coins: 2, xp: 20, minutes: 25 });
    expect(timerDefaults("primaire")).toEqual({ focus: 15, pause: 5 });
    expect(challengeWinner("a", 30, "b", 40)).toBe("b");
    expect(challengeWinner("a", 30, "b", 30)).toBe("tie");
    expect(challengeWinner("a", 0, "b", 0)).toBeNull();
    expect(makeFriendCode(() => 0)).toBe("AAAAAA");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(weekdayOf("2026-11-16")).toBe(0);
    expect(cleanSlots([{ jour: 0, debut: "8:00", fin: "08:55", matiere: " Français ", salle: "" }, { jour: 7, debut: "09:00", fin: "10:00", matiere: "X", salle: "" }, { jour: 1, debut: "10:00", fin: "09:00", matiere: "Y", salle: "" }])).toEqual([
      { weekday: 0, start: "08:00", end: "08:55", title: "Français", room: "" },
    ]);
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

import { PROGRAMMES, PROGRAMMES_BY_YEAR, chapterById, programmeFor, programmeForPrompt, programmeKey, schoolYearOn } from "../../src/lib/cervelle/programme";
import { COMPETENCES } from "../../src/lib/cervelle/competences";

describe("programme", () => {
  it("recognises how families write the class", () => {
    expect(programmeKey("CM2")).toBe("CM2");
    expect(programmeKey("5ème")).toBe("5e");
    expect(programmeKey("5e")).toBe("5e");
    expect(programmeKey("6ème")).toBe("6e");
    expect(programmeKey("Sixième")).toBe("6e");
    expect(programmeKey("4eme")).toBe("4e");
    expect(programmeKey("3e")).toBe("3e");
    expect(programmeKey("troisième")).toBe("3e");
    expect(programmeKey("CM1")).toBeNull();
    expect(programmeKey("2nde")).toBeNull();
  });
  it("has unique chapter ids", () => {
    const ids = Object.values(PROGRAMMES).flatMap((subjects) => subjects.flatMap((s) => s.chapters.map((c) => c.id)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(chapterById("cm2-hi-republique")?.grade).toBe("CM2");
    // Les ids déjà enregistrés sur des révisions de 5e ne bougent pas.
    expect(chapterById("c4-svt-terre")?.grade).toBe("5e");
    expect(chapterById("3e-svt-terre")?.grade).toBe("3e");
  });
  it("covers CM2, 6e, 5e, 4e and 3e, each read on the official texts", () => {
    expect(Object.keys(PROGRAMMES).sort()).toEqual(["3e", "4e", "5e", "6e", "CM2"]);
    for (const [grade, subjects] of Object.entries(PROGRAMMES)) {
      for (const s of subjects) {
        expect(s.chapters.length, `${grade} ${s.subject}`).toBeGreaterThan(0);
        expect(s.verifie, `${grade} ${s.subject}`).toBe(true);
        for (const c of s.chapters) expect(c.notions.length, c.id).toBeGreaterThan(0);
      }
    }
    // 4e et 3e : français et maths encore sur le programme 2020.
    expect(PROGRAMMES["4e"].find((s) => s.subject === "Mathématiques")?.source).toContain("2020");
    expect(PROGRAMMES["3e"].find((s) => s.subject === "Français")?.source).toContain("2020");
    expect(PROGRAMMES["6e"].find((s) => s.subject === "Français")?.source).toContain("2025");
  });
  it("gives every CM2 and 5e chapter its official competences, and nothing for unknown ids", () => {
    const ids = new Set(Object.values(PROGRAMMES).flatMap((subjects) => subjects.flatMap((s) => s.chapters.map((c) => c.id))));
    for (const id of Object.keys(COMPETENCES)) expect(ids.has(id), id).toBe(true);
    for (const grade of ["CM2", "5e"]) {
      for (const s of PROGRAMMES[grade]) {
        for (const c of s.chapters) expect(c.competences?.length ?? 0, c.id).toBeGreaterThan(0);
      }
    }
    expect(chapterById("cm2-ma-fractions")?.chapter.competences).toContain("Comparer, additionner et soustraire des fractions");
    expect(programmeForPrompt("5e")).toContain("Savoir-faire attendus : Connaître et utiliser les priorités opératoires");
  });
  it("switches school year on 1 August, within the years it knows", () => {
    expect(schoolYearOn(new Date("2026-11-27T10:00:00Z"))).toBe("2026-2027");
    expect(schoolYearOn(new Date("2027-07-31T12:00:00Z"))).toBe("2026-2027");
    expect(schoolYearOn(new Date("2027-08-01T00:00:00Z"))).toBe("2027-2028");
    expect(schoolYearOn(new Date("2025-03-01T00:00:00Z"))).toBe("2026-2027");
    expect(schoolYearOn(new Date("2031-10-01T00:00:00Z"))).toBe("2027-2028");
  });
  it("keeps the 2026-2027 programmes until the 2027 rentrée", () => {
    const before = new Date("2027-06-15T00:00:00Z");
    expect(programmeFor("CM2", before)).toBe(PROGRAMMES.CM2);
    expect(programmeFor("6e", before)).toBe(PROGRAMMES["6e"]);
  });
  it("gives each chapter id one class, in every year", () => {
    const owner = new Map<string, string>();
    for (const [year, programmes] of Object.entries(PROGRAMMES_BY_YEAR)) {
      const ids = Object.values(programmes).flatMap((subjects) => subjects.flatMap((s) => s.chapters.map((c) => c.id)));
      expect(new Set(ids).size, year).toBe(ids.length);
      expect(Object.keys(programmes).sort(), year).toEqual(["3e", "4e", "5e", "6e", "CM2"]);
      for (const [grade, subjects] of Object.entries(programmes)) {
        for (const s of subjects) {
          expect(s.verifie, `${year} ${grade} ${s.subject}`).toBe(true);
          for (const c of s.chapters) {
            expect(owner.get(c.id) ?? grade, c.id).toBe(grade);
            owner.set(c.id, grade);
          }
        }
      }
    }
  });
});
