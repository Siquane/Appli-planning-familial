import * as Notifications from "expo-notifications";
import { digestBody, morningBody, morningTitle, syncEveningDigest, syncMorningDigest, syncTaskReminders } from "../notifications";
import type { Task } from "../../api/types";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  setNotificationChannelAsync: jest.fn(async () => {}),
  SchedulableTriggerInputTypes: { WEEKLY: "weekly", DATE: "date" },
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { MAX: "max" },
}));
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const N = Notifications as jest.Mocked<typeof Notifications>;

const task = (over: Partial<Task>): Task =>
  ({ id: "t", title: "Tâche", weekday: 0, time: "08:00", recurring: true, reminder: false, ...over }) as Task;

beforeEach(() => jest.clearAllMocks());

describe("digestBody", () => {
  it("lists the day's tasks in time order, three at most", () => {
    const tasks = [
      task({ title: "Piano", time: "17:30", weekday: 1 }),
      task({ title: "École", time: "08:20", weekday: 1 }),
      task({ title: "Courses", time: "12:00", weekday: 1 }),
      task({ title: "Bain", time: "19:00", weekday: 1 }),
      task({ title: "Autre jour", weekday: 2 }),
    ];
    expect(digestBody(tasks, 1)).toBe("4 tâches : 08:20 École, 12:00 Courses, 17:30 Piano et 1 autre.");
    expect(digestBody(tasks, 3)).toBeNull();
  });
});

describe("syncTaskReminders", () => {
  it("never cancels birthday or digest notifications", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: "birthday:m1" },
      { identifier: "digest:0" },
      { identifier: "old-task" },
    ] as never);
    await syncTaskReminders([]);
    const cancelled = N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0]);
    expect(cancelled).toEqual(["old-task"]);
  });
});

describe("syncEveningDigest", () => {
  it("schedules the evening before each day that has tasks, at 20:00", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "digest:3" }] as never);
    await syncEveningDigest([task({ weekday: 1, title: "Piano", time: "17:30" })], true);

    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith("digest:3");
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const req = N.scheduleNotificationAsync.mock.calls[0][0] as { identifier: string; trigger: { weekday: number; hour: number } };
    // Tuesday's tasks are announced Monday evening (Expo weekday 2 = lundi).
    expect(req.identifier).toBe("digest:0");
    expect(req.trigger).toMatchObject({ weekday: 2, hour: 20 });
  });

  it("only clears its notifications when turned off", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "digest:0" }, { identifier: "birthday:m1" }] as never);
    await syncEveningDigest([task({ weekday: 1 })], false);
    expect(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual(["digest:0"]);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe("tasks left out of the digests", () => {
  it("are skipped in the evening and morning summaries", () => {
    const tasks = [task({ title: "Coucher", time: "20:30", weekday: 1, inDigest: false }), task({ title: "Piano", time: "17:30", weekday: 1 })];
    expect(digestBody(tasks, 1)).toBe("1 tâche : 17:30 Piano.");
    expect(morningBody(tasks, [], 1)).toBe("17:30 Piano");
    expect(digestBody([tasks[0]], 1)).toBeNull();
  });
});

describe("morning digest", () => {
  const members = [{ id: "m1", name: "Jules" }, { id: "m2", name: "Edouard" }] as never;

  it("lists every task of the day, one per line, with who does it", () => {
    const tasks = [
      task({ title: "Devoirs", time: "17:30", weekday: 2, memberIds: ["m1", "m2"] }),
      task({ title: "École", time: "08:20", weekday: 2, memberIds: ["m1"] }),
      task({ title: "Courses", time: "12:00", weekday: 2, memberIds: [] }),
    ];
    expect(morningBody(tasks, members, 2)).toBe("08:20 École · Jules\n12:00 Courses\n17:30 Devoirs · Jules, Edouard");
    expect(morningTitle(tasks, 2)).toBe("Aujourd'hui : 3 tâches");
    expect(morningBody(tasks, members, 3)).toBeNull();
  });

  it("schedules each day that has tasks at the chosen time, on the important channel", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "morning:4" }, { identifier: "digest:0" }] as never);
    await syncMorningDigest([task({ weekday: 0, title: "Piano", time: "17:30" })], [], true, "08:45");
    expect(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual(["morning:4"]);
    expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const req = N.scheduleNotificationAsync.mock.calls[0][0] as { identifier: string; trigger: object };
    // Monday morning (Expo weekday 2 = lundi), 08:45.
    expect(req.identifier).toBe("morning:0");
    expect(req.trigger).toMatchObject({ weekday: 2, hour: 8, minute: 45, channelId: "morning" });
  });

  it("only clears its notifications when turned off", async () => {
    N.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: "morning:0" }, { identifier: "digest:0" }] as never);
    await syncMorningDigest([task({ weekday: 0 })], [], false, "09:00");
    expect(N.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual(["morning:0"]);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
