import * as Notifications from "expo-notifications";
import { digestBody, syncEveningDigest, syncTaskReminders } from "../notifications";
import type { Task } from "../../api/types";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  SchedulableTriggerInputTypes: { WEEKLY: "weekly", DATE: "date" },
}));

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
