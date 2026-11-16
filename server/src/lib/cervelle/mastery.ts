// How a notion's label moves with the child's answers (spaced repetition).
//
//   « En cours »  (new)       not practised yet
//   « À revoir »  (review)    a recent mistake, or a review that is due
//   « Maîtrisé »  (mastered)  answered right several times, spaced out
//
// Each right answer lengthens the wait before the notion comes back
// (REVIEW_INTERVALS_DAYS); a wrong answer sends it back to « À revoir » now.
// A mastered notion whose review date has passed shows as « À revoir » again.

export type Mastery = "new" | "review" | "mastered";

export const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 16, 35];
/** Right answers in a row needed for « Maîtrisé ». */
export const MASTERED_STREAK = 2;

const DAY_MS = 86_400_000;

export interface NotionState {
  mastery: string;
  streak: number;
  nextReviewAt: Date | null;
  lastAnsweredAt: Date | null;
}

export function applyAnswer(state: NotionState, correct: boolean, now: Date = new Date()): NotionState {
  if (!correct) {
    return { mastery: "review", streak: 0, nextReviewAt: now, lastAnsweredAt: now };
  }
  // Several right answers within the same few minutes count once: mastery
  // needs answers spread over time, not one lucky quiz.
  const sameSitting = state.lastAnsweredAt && now.getTime() - state.lastAnsweredAt.getTime() < 20 * 60 * 1000;
  const streak = sameSitting && state.streak > 0 ? state.streak : state.streak + 1;
  const interval = REVIEW_INTERVALS_DAYS[Math.min(streak, REVIEW_INTERVALS_DAYS.length - 1)];
  const mastery: Mastery = streak >= MASTERED_STREAK ? "mastered" : state.mastery === "review" ? "review" : "new";
  return { mastery, streak, nextReviewAt: new Date(now.getTime() + interval * DAY_MS), lastAnsweredAt: now };
}

/** The label to show today. */
export function displayedMastery(state: Pick<NotionState, "mastery" | "nextReviewAt">, now: Date = new Date()): Mastery {
  if (state.mastery === "mastered" && state.nextReviewAt && state.nextReviewAt.getTime() <= now.getTime()) return "review";
  if (state.mastery === "review" || state.mastery === "mastered") return state.mastery;
  return "new";
}

/** A parent notion takes the weakest label of its sub-notions. */
export function combinedMastery(labels: Mastery[]): Mastery {
  if (labels.length === 0) return "new";
  if (labels.includes("review")) return "review";
  if (labels.every((l) => l === "mastered")) return "mastered";
  return "new";
}

/**
 * Progress of a revision in percent: reading the sheets, a quiz, the final
 * test, and above all the notions mastered.
 */
export function revisionProgress(p: { sheetsRead: boolean; quizBest: number | null; examBest: number | null; mastered: number; notions: number }): number {
  const steps = (p.sheetsRead ? 1 : 0) + (p.quizBest !== null ? 1 : 0) + (p.examBest !== null ? 1 : 0);
  const masteredShare = p.notions ? p.mastered / p.notions : 0;
  return Math.round(steps * 10 + masteredShare * 70);
}
