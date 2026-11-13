import { nowTime, todaySummary } from "../today";

const tasks = [
  { id: "a", title: "École", weekday: 2, time: "08:20" },
  { id: "b", title: "Piano", weekday: 2, time: "17:30" },
  { id: "c", title: "Autre jour", weekday: 3, time: "09:00" },
] as never;
const meals = [{ weekday: 2, type: "dîner", recipeId: "r1", title: "" }, { weekday: 2, type: "déjeuner", recipeId: null, title: "Cantine" }] as never;
const recipes = [{ id: "r1", title: "Gratin" }] as never;

describe("todaySummary", () => {
  it("counts today's tasks, finds the next one and tonight's dinner", () => {
    const s = todaySummary(2, "12:00", tasks, meals, recipes, undefined);
    expect(s.taskCount).toBe(2);
    expect(s.next?.title).toBe("Piano");
    expect(s.dinner).toBe("Gratin");
    expect(s.budget).toEqual({ spentCents: 0, capCents: null });
  });

  it("has no next task late in the evening, and no dinner when none is planned", () => {
    const s = todaySummary(3, "23:00", tasks, meals, recipes, undefined);
    expect(s.next).toBeNull();
    expect(s.dinner).toBeNull();
  });

  it("adds up the caps of the month when there are some", () => {
    const budget = {
      month: "2026-11",
      totalCents: 70000,
      expenses: [],
      byCategory: [
        { category: "courses", totalCents: 50000, limitCents: 60000 },
        { category: "loisirs", totalCents: 20000, limitCents: 10000 },
        { category: "autre", totalCents: 0, limitCents: null },
      ],
    } as never;
    expect(todaySummary(2, "08:00", tasks, meals, recipes, budget).budget).toEqual({ spentCents: 70000, capCents: 70000 });
  });

  it("formats the current time as HH:MM", () => {
    expect(nowTime(new Date(2026, 10, 13, 7, 5))).toBe("07:05");
  });
});
