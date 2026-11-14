import type { Plan } from "../../api/types";
import { budgetOfferLabel, hasPaidPack, trialDaysLeft, trialNotice, trialReminderDate } from "../premium";

const DAY = 86_400_000;
const NOW = new Date("2026-11-14T12:00:00Z");
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY).toISOString();

const plan = (budget: Partial<Plan["packs"]["budget"]>, meals = false): Plan =>
  ({
    packs: { budget: { active: false, until: null, ...budget }, meals: { active: meals, until: null } },
    meals: {},
    documents: { used: 0, limit: 20 },
  }) as unknown as Plan;

const offer = { available: true, active: false, days: 28, endsAt: null };
const running = (n: number) => ({ available: false, active: true, days: 28, endsAt: inDays(n) });
const over = { available: false, active: false, days: 28, endsAt: inDays(-3) };

describe("Budget+ trial", () => {
  it("counts days left, the current one included", () => {
    expect(trialDaysLeft(inDays(28), NOW)).toBe(28);
    expect(trialDaysLeft(inDays(0.2), NOW)).toBe(1);
    expect(trialDaysLeft(inDays(-1), NOW)).toBe(0);
    expect(trialDaysLeft(null, NOW)).toBe(0);
  });

  it("tells what to show on the Budget tab", () => {
    expect(trialNotice(plan({ trial: offer }), NOW)).toEqual({ kind: "offer", text: "Essaie Budget+ gratuitement pendant 4 semaines." });
    expect(trialNotice(plan({ active: true, until: inDays(20), trial: running(20) }), NOW)).toMatchObject({ kind: "running", daysLeft: 20, text: "Essai gratuit de Budget+ : il reste 20 jours." });
    expect(trialNotice(plan({ active: true, trial: running(5) }), NOW)).toMatchObject({ kind: "ending", text: "Plus que 5 jours d'essai gratuit de Budget+." });
    expect(trialNotice(plan({ active: true, trial: running(1) }), NOW)).toMatchObject({ kind: "ending", text: "Plus que 1 jour d'essai gratuit de Budget+." });
    // Over, or no trial info: nothing to say.
    expect(trialNotice(plan({ trial: over }), NOW)).toBeNull();
    expect(trialNotice(plan({}), NOW)).toBeNull();
    expect(trialNotice(undefined, NOW)).toBeNull();
  });

  it("is not a paid pack", () => {
    expect(hasPaidPack(plan({ active: true, trial: running(10) }))).toBe(false);
    expect(hasPaidPack(plan({ active: true, until: inDays(200), trial: { ...over } }))).toBe(true);
    expect(hasPaidPack(plan({}, true))).toBe(true);
    expect(hasPaidPack(undefined)).toBe(false);
  });

  it("invites to try it only while it's on offer", () => {
    expect(budgetOfferLabel(plan({ trial: offer }))).toBe("Essayer 4 semaines gratuitement");
    expect(budgetOfferLabel(plan({ trial: over }))).toBe("Voir Budget+");
    expect(budgetOfferLabel(undefined)).toBe("Voir Budget+");
  });

  it("reminds 5 days before the end, at 10:00, unless that moment is gone", () => {
    const date = trialReminderDate(inDays(20), NOW)!;
    expect(date.getHours()).toBe(10);
    expect(Math.round((Date.parse(inDays(20)) - date.getTime()) / DAY)).toBeGreaterThanOrEqual(5);
    expect(date.getTime()).toBeGreaterThan(NOW.getTime());
    expect(trialReminderDate(inDays(3), NOW)).toBeNull();
    expect(trialReminderDate(null, NOW)).toBeNull();
  });
});
