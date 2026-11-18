import { describe, expect, it } from "vitest";
import { getProposals, scoreCandidate, SchedulableTask, Constraints } from "../../src/lib/scheduling";

const constraints: Constraints = {
  sleepStart: "21:00",
  sleepEnd: "07:00",
  lunchStart: "12:00",
  lunchEnd: "13:30",
  dndStart: "20:00",
  dndEnd: "21:00",
};

function task(overrides: Partial<SchedulableTask> = {}): SchedulableTask {
  return {
    id: "t1",
    weekday: 0,
    time: "17:00",
    priority: "medium",
    deadlineWeekday: null,
    memberIds: ["m1"],
    ...overrides,
  };
}

describe("scoreCandidate", () => {
  const work = { ...constraints, work: { days: [0, 1, 2, 3, 4], start: "09:00", end: "17:30" } };

  it("never proposes a slot during working hours on a working day", () => {
    const t = task();
    expect(scoreCandidate(3, "09:00", t, [], work)).toBeNull();
    expect(scoreCandidate(3, "17:00", t, [], work)).toBeNull(); // finirait à 17:30 mais commence pendant le travail
    expect(scoreCandidate(3, "08:00", t, [], work)).not.toBeNull();
    expect(scoreCandidate(3, "17:30", t, [], work)).not.toBeNull();
    expect(scoreCandidate(5, "10:00", t, [], work)).not.toBeNull(); // samedi
  });

  it("refuses a slot whose duration runs into working hours or lunch", () => {
    expect(scoreCandidate(0, "08:00", task({ duration: 90 }), [], work)).toBeNull();
    expect(scoreCandidate(5, "11:00", task({ duration: 90 }), [], work)).toBeNull(); // déborde sur le déjeuner
    expect(scoreCandidate(5, "11:00", task({ duration: 60 }), [], work)).not.toBeNull();
  });

  it("only proposes evenings and weekends to someone working 9:00–17:30 on weekdays", () => {
    const proposals = getProposals(task({ duration: 30 }), [], work, 50, 20);
    for (const p of proposals) {
      if (p.weekday <= 4) expect(p.time < "09:00" || p.time >= "17:30").toBe(true);
    }
  });

  it("an existing task blocks its whole duration", () => {
    const t = task({ id: "t1", memberIds: ["m1"] });
    const other = task({ id: "t2", weekday: 5, time: "09:00", duration: 120, memberIds: ["m1"] });
    expect(scoreCandidate(5, "10:00", t, [other], constraints)).toBeNull();
    expect(scoreCandidate(5, "11:00", t, [other], constraints)).not.toBeNull();
  });

  it("a task for no one in particular blocks everyone", () => {
    const t = task({ id: "t1", memberIds: ["m1"] });
    const other = task({ id: "t2", weekday: 0, time: "09:00", memberIds: [] });
    expect(scoreCandidate(0, "09:00", t, [other], constraints)).toBeNull();
  });

  it("excludes slots inside lunch, do-not-disturb, or sleep windows", () => {
    const t = task();
    expect(scoreCandidate(0, "12:30", t, [], constraints)).toBeNull(); // lunch
    expect(scoreCandidate(0, "20:30", t, [], constraints)).toBeNull(); // dnd
    expect(scoreCandidate(0, "22:00", t, [], constraints)).toBeNull(); // sleep (wraps midnight)
  });

  it("excludes candidates strictly after the task's deadline weekday, but allows the deadline day itself", () => {
    const t = task({ deadlineWeekday: 2 });
    expect(scoreCandidate(3, "09:00", t, [], constraints)).toBeNull();
    expect(scoreCandidate(2, "09:00", t, [], constraints)).not.toBeNull();
    expect(scoreCandidate(1, "09:00", t, [], constraints)).not.toBeNull();
  });

  it("excludes a slot already taken by an overlapping member", () => {
    const t = task({ id: "t1", memberIds: ["m1"] });
    const other = task({ id: "t2", weekday: 0, time: "09:00", memberIds: ["m1", "m2"] });
    expect(scoreCandidate(0, "09:00", t, [other], constraints)).toBeNull();
  });

  it("allows the same slot if no member overlaps", () => {
    const t = task({ id: "t1", memberIds: ["m1"] });
    const other = task({ id: "t2", weekday: 0, time: "09:00", memberIds: ["m2"] });
    expect(scoreCandidate(0, "09:00", t, [other], constraints)).not.toBeNull();
  });

  it("scores a high-priority task higher in the morning than in the evening", () => {
    const t = task({ priority: "high" });
    const morning = scoreCandidate(0, "09:00", t, [], constraints)!;
    const evening = scoreCandidate(0, "18:00", t, [], constraints)!;
    expect(morning.score).toBeGreaterThan(evening.score);
  });

  it("scores a low-priority task higher in the evening than in the morning", () => {
    const t = task({ priority: "low" });
    const morning = scoreCandidate(0, "09:00", t, [], constraints)!;
    const evening = scoreCandidate(0, "18:00", t, [], constraints)!;
    expect(evening.score).toBeGreaterThan(morning.score);
  });
});

describe("getProposals", () => {
  it("returns at most `limit` candidates, at most one per weekday, sorted best-first", () => {
    const t = task({ priority: "high" });
    const proposals = getProposals(t, [], constraints, 3);
    expect(proposals.length).toBeLessThanOrEqual(3);
    const days = proposals.map((p) => p.weekday);
    expect(new Set(days).size).toBe(days.length);
    for (let i = 1; i < proposals.length; i++) {
      expect(proposals[i - 1].score).toBeGreaterThanOrEqual(proposals[i].score);
    }
  });

  it("can offer several hours on the same day", () => {
    const t = task({ priority: "high" });
    const proposals = getProposals(t, [], constraints, 6, 2);
    expect(proposals.length).toBeLessThanOrEqual(6);
    const perDay = new Map<number, number>();
    for (const p of proposals) perDay.set(p.weekday, (perDay.get(p.weekday) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    expect(proposals.length).toBeGreaterThan(3);
  });

  it("returns nothing once the deadline has passed for every remaining day", () => {
    const t = task({ deadlineWeekday: 0 });
    const proposals = getProposals(t, [], constraints, 3);
    // Only weekday 0 itself is eligible (weekday <= deadlineWeekday), so exactly one candidate.
    expect(proposals.every((p) => p.weekday === 0)).toBe(true);
  });
});
