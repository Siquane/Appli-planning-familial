import { addDays, appointmentDayLabel, inWeek, reminderText, remindAt, shiftWeek, tasksOn, weekdayOfDay, weekOfDay, weekRange, weekTitle } from "../appointments";

const t = (over: Partial<{ appointmentDate: string | null; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; time: string }>) => ({ appointmentDate: null, weekday: 0 as const, time: "08:00", ...over });

describe("weeks", () => {
  it("finds the Monday and weekday of a date", () => {
    expect(weekOfDay("2026-12-03")).toBe("2026-11-30");
    expect(weekdayOfDay("2026-12-03")).toBe(3);
    expect(weekdayOfDay("2026-12-06")).toBe(6);
    expect(addDays("2026-11-30", 7)).toBe("2026-12-07");
    expect(shiftWeek("2026-11-16", -1)).toBe("2026-11-09");
  });

  it("names the week", () => {
    expect(weekTitle("2026-11-16", "2026-11-16")).toBe("Cette semaine");
    expect(weekTitle("2026-11-23", "2026-11-16")).toBe("Semaine prochaine");
    expect(weekTitle("2026-11-09", "2026-11-16")).toBe("Semaine dernière");
    expect(weekTitle("2026-11-30", "2026-11-16")).toBe("Semaine du 30 nov.");
    expect(weekRange("2026-11-16")).toBe("16 – 22 nov.");
    expect(weekRange("2026-11-30")).toBe("30 nov. – 6 déc.");
    expect(appointmentDayLabel("2026-12-03")).toBe("jeu. 3 déc.");
  });
});

describe("tasksOn", () => {
  it("shows weekly tasks every week and an appointment only in its own week", () => {
    const weekly = t({ weekday: 3, time: "18:00" });
    const rdv = t({ weekday: 3, time: "14:30", appointmentDate: "2026-12-03" });
    expect(tasksOn([weekly, rdv], 3, "2026-11-30")).toEqual([rdv, weekly]);
    expect(tasksOn([weekly, rdv], 3, "2026-11-23")).toEqual([weekly]);
    expect(inWeek(rdv, "2026-12-07")).toBe(false);
  });
});

describe("remindAt", () => {
  const now = new Date(2026, 10, 18, 15, 0);

  it("one hour before, or the evening before at 20:00", () => {
    expect(remindAt({ appointmentDate: "2026-12-03", time: "14:30", remind: "hour" }, now)).toEqual(new Date(2026, 11, 3, 13, 30));
    expect(remindAt({ appointmentDate: "2026-12-03", time: "14:30", remind: "eve" }, now)).toEqual(new Date(2026, 11, 2, 20, 0));
  });

  it("nothing when no reminder or already past", () => {
    expect(remindAt({ appointmentDate: "2026-12-03", time: "14:30", remind: null }, now)).toBeNull();
    expect(remindAt({ appointmentDate: "2026-11-18", time: "15:30", remind: "hour" }, now)).toBeNull();
    expect(remindAt({ appointmentDate: null, time: "15:30", remind: "hour" }, now)).toBeNull();
  });

  it("writes the reminder", () => {
    expect(reminderText({ title: "Dentiste", time: "14:30", location: "Cabinet Dupont", remind: "eve" })).toBe("Demain 14:30 · Dentiste (Cabinet Dupont)");
    expect(reminderText({ title: "Dentiste", time: "14:30", location: "", remind: "hour" })).toBe("Dans 1 h 14:30 · Dentiste");
  });
});
