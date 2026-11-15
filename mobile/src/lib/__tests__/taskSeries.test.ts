import { newSeriesId, planSeriesEdit, seriesOf, seriesSchedule } from "../taskSeries";
import type { Task, Weekday } from "../../api/types";

const task = (id: string, weekday: Weekday, time = "18:00", seriesId: string | null = "s1"): Task => ({
  id,
  title: "Sport",
  category: "Loisirs",
  weekday,
  date: "",
  time,
  duration: 30,
  priority: "medium",
  deadlineWeekday: null,
  recurring: true,
  reminder: false,
  flexible: false,
  synced: false,
  notes: "",
  memberIds: [],
  externalProvider: null,
  seriesId,
});

describe("newSeriesId", () => {
  it("is accepted by the server (8 to 40 letters, digits, _ or -)", () => {
    expect(newSeriesId()).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
  });
});

describe("seriesOf", () => {
  it("returns the task alone when it has no series", () => {
    const t = task("a", 1, "18:00", null);
    expect(seriesOf([t, task("b", 2, "18:00", null)], t)).toEqual([t]);
  });

  it("returns every task of the series in week order", () => {
    const list = [task("c", 4), task("a", 0), task("x", 2, "18:00", "other")];
    expect(seriesOf(list, list[0]).map((t) => t.id)).toEqual(["a", "c"]);
  });
});

describe("seriesSchedule", () => {
  it("gives the days and notices different times", () => {
    expect(seriesSchedule([task("a", 0, "18:00"), task("b", 2, "19:00")])).toEqual({ weekdays: [0, 2], dayTimes: { 0: "18:00", 2: "19:00" }, perDay: true });
    expect(seriesSchedule([task("a", 0), task("b", 2)]).perDay).toBe(false);
  });
});

describe("planSeriesEdit", () => {
  it("adds a task for each newly ticked day", () => {
    expect(planSeriesEdit([task("a", 0)], [0, 2, 4], { 0: "18:00", 2: "18:00", 4: "18:00" })).toEqual({
      updates: [{ id: "a", weekday: 0, time: "18:00" }],
      creates: [
        { weekday: 2, time: "18:00" },
        { weekday: 4, time: "18:00" },
      ],
      deletes: [],
    });
  });

  it("deletes the tasks of unticked days", () => {
    const plan = planSeriesEdit([task("a", 0), task("b", 2), task("c", 4)], [0, 4], { 0: "18:00", 4: "20:00" });
    expect(plan.deletes).toEqual(["b"]);
    expect(plan.updates).toEqual([
      { id: "a", weekday: 0, time: "18:00" },
      { id: "c", weekday: 4, time: "20:00" },
    ]);
    expect(plan.creates).toEqual([]);
  });

  it("moves an unticked task to a new day instead of deleting and recreating it", () => {
    const plan = planSeriesEdit([task("a", 0), task("b", 2)], [0, 3], { 0: "18:00", 3: "18:00" });
    expect(plan).toEqual({
      updates: [
        { id: "a", weekday: 0, time: "18:00" },
        { id: "b", weekday: 3, time: "18:00" },
      ],
      creates: [],
      deletes: [],
    });
  });

  it("keeps the time of a second task on the same day", () => {
    const plan = planSeriesEdit([task("a", 0, "08:00"), task("b", 0, "20:00")], [0], { 0: "09:00" });
    expect(plan.updates).toEqual([
      { id: "a", weekday: 0, time: "09:00" },
      { id: "b", weekday: 0 },
    ]);
  });
});
