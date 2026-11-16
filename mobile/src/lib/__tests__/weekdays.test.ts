import { color } from "../../theme/tokens";
import { categoryColor, dayOfWeek, progressLine, formatDuration, jsDayToWeekday, priorityLabel, todayWeekday } from "../weekdays";

describe("jsDayToWeekday", () => {
  it("maps JS Sun-first days onto the Lun-first 0..6 convention", () => {
    expect(jsDayToWeekday(1)).toBe(0); // Monday
    expect(jsDayToWeekday(0)).toBe(6); // Sunday
    expect(jsDayToWeekday(3)).toBe(2); // Wednesday
  });
});

describe("todayWeekday", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("derives from the current date using the same 0=Lun convention", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T12:00:00")); // a Wednesday
    expect(todayWeekday()).toBe(2);
  });
});

describe("categoryColor", () => {
  it("gives each category one of the logo's ring colours", () => {
    expect(categoryColor("École")).toBe(color.pillar1);
    expect(categoryColor("Travail")).toBe(color.pillar2);
    expect(categoryColor("Maison")).toBe(color.pillar3);
    expect(categoryColor("Loisirs")).toBe(color.pillar4);
    expect(categoryColor("Santé")).toBe(color.success);
  });
});

describe("priorityLabel", () => {
  it("returns a French label per priority", () => {
    expect(priorityLabel("high")).toBe("Priorité haute");
    expect(priorityLabel("medium")).toBe("Priorité moyenne");
    expect(priorityLabel("low")).toBe("Priorité basse");
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour as-is", () => {
    expect(formatDuration(15)).toBe("15 min");
    expect(formatDuration(45)).toBe("45 min");
  });

  it("formats whole hours without a minutes suffix", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours plus minutes, zero-padded", () => {
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(65)).toBe("1h05");
  });
});

describe("dayOfWeek", () => {
  it("gives the date of a weekday in a week, across months", () => {
    expect(dayOfWeek("2026-11-16", 0)).toBe("2026-11-16");
    expect(dayOfWeek("2026-11-16", 6)).toBe("2026-11-22");
    expect(dayOfWeek("2026-11-30", 3)).toBe("2026-12-03");
  });
});

describe("progressLine", () => {
  it("cheers on the day's progress", () => {
    expect(progressLine(0, 0).title).toBe("Journée libre");
    expect(progressLine(0, 4).title).toBe("C'est parti");
    expect(progressLine(1, 4)).toEqual({ title: "Bon début", detail: "Encore 3 tâches." });
    expect(progressLine(3, 5)).toEqual({ title: "Belle lancée !", detail: "Plus que 2 tâches." });
    expect(progressLine(4, 4).title).toBe("Tout est fait !");
  });
});
