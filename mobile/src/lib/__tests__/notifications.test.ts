// Only the pure date helpers are tested here; the native module is stubbed.
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));

import { advanceReminderDate, advanceReminderText, appointmentNotifications, daysUntilBirthday, digestTasks, nextBirthdayOccurrence, pocketMoneyMoments, reminderMoment, toExpoWeekday } from "../notifications";
import type { Task } from "../../api/types";

describe("toExpoWeekday", () => {
  it("maps the app's Lun..Dim convention onto Expo's Dim..Sam (1..7)", () => {
    expect(toExpoWeekday(0)).toBe(2); // Lun -> 2
    expect(toExpoWeekday(6)).toBe(1); // Dim -> 1
    expect(toExpoWeekday(5)).toBe(7); // Sam -> 7
  });
});

describe("reminderMoment", () => {
  it("fires 10 minutes before the task, same day", () => {
    expect(reminderMoment(2, "09:00")).toEqual({ weekday: 2, hour: 8, minute: 50 });
  });

  it("rolls onto the previous weekday for an early-morning task", () => {
    expect(reminderMoment(0, "00:05")).toEqual({ weekday: 6, hour: 23, minute: 55 });
  });

  it("wraps Lundi back to Dimanche", () => {
    expect(reminderMoment(0, "00:00")).toEqual({ weekday: 6, hour: 23, minute: 50 });
  });
});

describe("nextBirthdayOccurrence / daysUntilBirthday", () => {
  const from = new Date(2026, 2, 10); // 10 mars 2026

  it("uses this year's occurrence when the birthday hasn't happened yet", () => {
    const next = nextBirthdayOccurrence("2016-04-12", from);
    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(3);
    expect(next.getDate()).toBe(12);
    expect(daysUntilBirthday("2016-04-12", from)).toBe(33);
  });

  it("rolls over to next year when this year's date has passed", () => {
    const next = nextBirthdayOccurrence("2016-01-05", from);
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(5);
  });

  it("returns 0 for a birthday that is today", () => {
    expect(daysUntilBirthday("2016-03-10", from)).toBe(0);
  });
});

describe("appointments", () => {
  const base = { category: "Santé", date: "", duration: 30, priority: "medium", deadlineWeekday: null, recurring: false, reminder: false, flexible: false, synced: false, notes: "", externalProvider: null, seriesId: null, stars: 1, inDigest: true } as const;
  const rdv: Task = { ...base, memberIds: [], id: "r1", title: "Dentiste", weekday: 3, time: "14:30", appointmentDate: "2026-12-03", location: "Cabinet Dupont", remind: "eve" };
  const weekly: Task = { ...base, memberIds: [], id: "w1", title: "Piscine", weekday: 3, time: "18:00", appointmentDate: null, location: "", remind: null };
  const now = new Date(2026, 10, 18, 15, 0);

  it("keeps appointments out of the weekly recaps", () => {
    expect(digestTasks([rdv, weekly], 3).map((t) => t.id)).toEqual(["w1"]);
  });

  it("plans the reminder and the morning recap of the day", () => {
    const planned = appointmentNotifications([rdv, weekly], [], { enabled: true, time: "09:00" }, now);
    expect(planned).toEqual([
      { identifier: "rdv:r1", date: new Date(2026, 11, 2, 20, 0), title: "Rendez-vous", body: "Demain 14:30 · Dentiste (Cabinet Dupont)" },
      { identifier: "rdvday:2026-12-03", date: new Date(2026, 11, 3, 9, 0), title: "Rendez-vous aujourd'hui", body: "14:30 Dentiste · Cabinet Dupont" },
    ]);
  });

  it("skips past appointments and the morning recap when it is off", () => {
    expect(appointmentNotifications([{ ...rdv, appointmentDate: "2026-11-10" }], [], { enabled: true, time: "09:00" }, now)).toEqual([]);
    expect(appointmentNotifications([{ ...rdv, remind: null }], [], { enabled: false, time: "09:00" }, now)).toEqual([]);
  });
});

describe("pocketMoneyMoments", () => {
  it("weekly and monthly, at 9:00", () => {
    expect(pocketMoneyMoments({ frequency: "weekly", day: 5, nextDay: "2026-11-21" }, 2)).toEqual([new Date(2026, 10, 21, 9), new Date(2026, 10, 28, 9)]);
    expect(pocketMoneyMoments({ frequency: "monthly", day: 1, nextDay: "2026-12-01" }, 2)).toEqual([new Date(2026, 11, 1, 9), new Date(2027, 0, 1, 9)]);
    expect(pocketMoneyMoments(null)).toEqual([]);
  });
});

describe("advance birthday reminder", () => {
  it("is N days before the next birthday, at 9 h, unless already past", () => {
    const from = new Date(2026, 10, 27, 10, 0);
    expect(advanceReminderDate("2000-12-10T12:00:00", 7, from)).toEqual(new Date(2026, 11, 3, 9, 0));
    expect(advanceReminderDate("2000-11-30T12:00:00", 7, from)).toBeNull();
    expect(advanceReminderDate("2000-12-10T12:00:00", 0, from)).toBeNull();
    expect(advanceReminderText({ id: "a", name: "Mamie", birthday: "", giftsLeft: 2 }, 7)).toBe("Dans 7 jours : l'anniversaire de Mamie. Tu as 2 idées de cadeau.");
    expect(advanceReminderText({ id: "a", name: "Inès", birthday: "" }, 1)).toBe("Demain : l'anniversaire d'Inès. Pense au cadeau !");
  });
});
