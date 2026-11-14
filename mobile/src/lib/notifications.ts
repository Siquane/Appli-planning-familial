import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useToastStore } from "../state/toastStore";
import type { Member, Task, Weekday } from "../api/types";

// How long before a recurring task's time its reminder fires.
const REMINDER_LEAD_MINUTES = 10;

// Local notifications don't support a native yearly trigger we can rely on
// across Expo/OS versions, so birthdays use a one-shot DATE trigger for the
// next occurrence — syncBirthdayReminders recomputes and reschedules it
// every time it runs (app open, member list change), so it's always
// pointing at the next upcoming date.
const BIRTHDAY_NOTIFICATION_HOUR = 9;
const BIRTHDAY_ID_PREFIX = "birthday:";

// Next occurrence (this year if still upcoming today, else next year) of a
// birthday's month/day, at BIRTHDAY_NOTIFICATION_HOUR local time.
export function nextBirthdayOccurrence(birthday: string, from: Date = new Date()): Date {
  const b = new Date(birthday);
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(from.getFullYear(), b.getMonth(), b.getDate(), BIRTHDAY_NOTIFICATION_HOUR, 0, 0, 0);
  if (next < today) {
    next = new Date(from.getFullYear() + 1, b.getMonth(), b.getDate(), BIRTHDAY_NOTIFICATION_HOUR, 0, 0, 0);
  }
  return next;
}

export function daysUntilBirthday(birthday: string, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const next = nextBirthdayOccurrence(birthday, from);
  const nextDay = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  return Math.round((nextDay.getTime() - today.getTime()) / 86_400_000);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Call when the user flips a "Rappel" chip on — prompts for permission right
// then if needed, and warns immediately (rather than silently) if it's
// refused, since the toggle would otherwise look on but never actually fire.
export async function confirmReminderPermission(): Promise<boolean> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    useToastStore.getState().show("Active les notifications dans les réglages du téléphone pour recevoir ce rappel.");
  }
  return granted;
}

// App weekdays: 0=Lun..6=Dim. Expo's WeeklyTriggerInput: 1=Dim..7=Sam.
export function toExpoWeekday(weekday: Weekday): number {
  return ((weekday + 1) % 7) + 1;
}

// The reminder fires a few minutes before the task itself, which can roll
// onto the previous day (and previous weekday) for early-morning tasks.
export function reminderMoment(weekday: Weekday, time: string): { weekday: Weekday; hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  let totalMinutes = h * 60 + m - REMINDER_LEAD_MINUTES;
  let day = weekday;
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
    day = ((day + 6) % 7) as Weekday;
  }
  return { weekday: day, hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

// Reconciles the device's scheduled local notifications against the tasks
// that currently want a reminder (recurring + reminder). Notification
// identifiers are the task id, so this is the only place that needs to know
// about reminders — no separate id bookkeeping. No-ops without permission or
// on web (local scheduled notifications aren't meaningfully supported there).
export async function syncTaskReminders(tasks: Task[]): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const desired = tasks.filter((t) => t.recurring && t.reminder);
  const desiredIds = new Set(desired.map((t) => t.id));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      // Only task reminders (bare task ids): birthday and digest ids carry a
      // "prefix:" and are owned by their own sync functions.
      .filter((req) => req.identifier && !req.identifier.includes(":") && !desiredIds.has(req.identifier))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );

  await Promise.all(
    desired.map(async (task) => {
      const { weekday, hour, minute } = reminderMoment(task.weekday, task.time);
      await Notifications.cancelScheduledNotificationAsync(task.id).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: task.id,
        content: { title: "Rappel Passerelle", body: `${task.title} à ${task.time}` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(weekday), hour, minute },
      });
    })
  );
}

// Reconciles scheduled birthday reminders against members that have a
// birthday set. Identifiers are prefixed to avoid colliding with task
// reminder ids (both use the same notification store).
export async function syncBirthdayReminders(members: Member[]): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const withBirthday = members.filter((m): m is Member & { birthday: string } => !!m.birthday);
  const desiredIds = new Set(withBirthday.map((m) => `${BIRTHDAY_ID_PREFIX}${m.id}`));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => req.identifier?.startsWith(BIRTHDAY_ID_PREFIX) && !desiredIds.has(req.identifier))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );

  await Promise.all(
    withBirthday.map(async (member) => {
      const identifier = `${BIRTHDAY_ID_PREFIX}${member.id}`;
      const date = nextBirthdayOccurrence(member.birthday);
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title: "Anniversaire", body: `C'est l'anniversaire de ${member.name} aujourd'hui !` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
      });
    })
  );
}

// ---------------------------------------------------------------------------
// Evening digest: every evening at DIGEST_HOUR, a summary of tomorrow's tasks.
// Tasks are a weekly template, so one WEEKLY notification per weekday is
// enough; it's rebuilt whenever the task list (or the setting) changes.

export const DIGEST_HOUR = 20;
const DIGEST_ID_PREFIX = "digest:";
const DIGEST_MAX_LISTED = 3;

/** Text announcing `weekday`'s tasks, or null when nothing is planned that day. */
export function digestBody(tasks: Task[], weekday: Weekday): string | null {
  const day = tasks.filter((t) => t.weekday === weekday).sort((a, b) => a.time.localeCompare(b.time));
  if (day.length === 0) return null;
  const listed = day.slice(0, DIGEST_MAX_LISTED).map((t) => `${t.time} ${t.title}`);
  const more = day.length - listed.length;
  return `${day.length} tâche${day.length > 1 ? "s" : ""} : ${listed.join(", ")}${more > 0 ? ` et ${more} autre${more > 1 ? "s" : ""}` : ""}.`;
}

export async function syncEveningDigest(tasks: Task[], enabled: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => req.identifier?.startsWith(DIGEST_ID_PREFIX))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );
  if (!enabled) return;

  await Promise.all(
    ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map(async (evening) => {
      const tomorrow = ((evening + 1) % 7) as Weekday;
      const body = digestBody(tasks, tomorrow);
      if (!body) return;
      await Notifications.scheduleNotificationAsync({
        identifier: `${DIGEST_ID_PREFIX}${evening}`,
        content: { title: "Demain", body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(evening), hour: DIGEST_HOUR, minute: 0 },
      });
    })
  );
}
