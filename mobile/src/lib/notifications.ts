import * as Notifications from "expo-notifications";
import { TRIAL_REMINDER_DAYS, trialReminderDate } from "./premium";
import { Platform } from "react-native";
import { useToastStore } from "../state/toastStore";
import type { Member, PocketMoneyRule, Task, Weekday } from "../api/types";
import { whoLabel } from "../widgets/snapshot";
import { dayKey, parseDay, reminderText, remindAt } from "./appointments";
import { formatEuros } from "./money";
import { de } from "./elision";

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

/** Someone whose birthday gets reminders: a family member or a friend (Anniversaires). */
export interface BirthdayPerson {
  id: string;
  name: string;
  /** ISO date or « AAAA-MM-JJ ». */
  birthday: string;
  /** Gift ideas not bought yet. */
  giftsLeft?: number;
}

/** The reminder `days` before the next birthday (null when it's already past, or `days` is 0). */
export function advanceReminderDate(birthday: string, days: number, from: Date = new Date()): Date | null {
  if (days <= 0) return null;
  const next = nextBirthdayOccurrence(birthday, from);
  const at = new Date(next.getFullYear(), next.getMonth(), next.getDate() - days, BIRTHDAY_NOTIFICATION_HOUR, 0, 0, 0);
  return at > from ? at : null;
}

export function advanceReminderText(person: BirthdayPerson, days: number): string {
  const when = days === 1 ? "Demain" : `Dans ${days} jours`;
  const gifts = person.giftsLeft ? ` Tu as ${person.giftsLeft} idée${person.giftsLeft > 1 ? "s" : ""} de cadeau.` : " Pense au cadeau !";
  return `${when} : l'anniversaire ${de(person.name)}.${gifts}`;
}

// Reconciles scheduled birthday reminders (the day itself, and `remindDays`
// before) against everyone with a birthday. Identifiers start with
// « birthday: » so they never collide with task reminder ids.
export async function syncBirthdayReminders(people: BirthdayPerson[], remindDays = 0): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const plans = people.flatMap((p) => {
    const out = [{ identifier: `${BIRTHDAY_ID_PREFIX}${p.id}`, date: nextBirthdayOccurrence(p.birthday), title: "Anniversaire", body: `C'est l'anniversaire ${de(p.name)} aujourd'hui !` }];
    const soon = advanceReminderDate(p.birthday, remindDays);
    if (soon) out.push({ identifier: `${BIRTHDAY_ID_PREFIX}soon:${p.id}`, date: soon, title: "Anniversaire bientôt", body: advanceReminderText(p, remindDays) });
    return out;
  });
  const desiredIds = new Set(plans.map((p) => p.identifier));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => req.identifier?.startsWith(BIRTHDAY_ID_PREFIX) && !desiredIds.has(req.identifier))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );

  await Promise.all(
    plans.map(async (p) => {
      await Notifications.cancelScheduledNotificationAsync(p.identifier).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: p.identifier,
        content: { title: p.title, body: p.body, data: { url: "/birthdays" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date },
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
  const day = digestTasks(tasks, weekday);
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

/**
 * Les tâches de la semaine type d'un jour qui vont dans les récaps (case
 * « Dans les récaps »), dans l'ordre de l'heure. Les rendez-vous (datés) ont
 * leurs propres notifications (syncAppointmentNotifications).
 */
export function digestTasks(tasks: Task[], weekday: Weekday): Task[] {
  return tasks.filter((t) => t.weekday === weekday && t.inDigest !== false && !t.appointmentDate).sort((a, b) => a.time.localeCompare(b.time));
}

// ---------------------------------------------------------------------------
// Récap du matin : chaque matin (9 h par défaut), toutes les tâches du jour,
// une par ligne avec qui la fait. Canal Android « important » : la
// notification descend en bannière avec un son ; dépliée, elle montre tout.

const MORNING_ID_PREFIX = "morning:";
export const MORNING_CHANNEL = "morning";
const MORNING_MAX_LINES = 12;

/** « 08:00 École · Jules » par ligne, ou null quand rien n'est prévu. */
export function morningBody(tasks: Task[], members: Member[], weekday: Weekday): string | null {
  const day = digestTasks(tasks, weekday);
  if (day.length === 0) return null;
  const lines = day.slice(0, MORNING_MAX_LINES).map((t) => {
    const who = whoLabel(t.memberIds ?? [], members);
    return `${t.time} ${t.title}${who ? ` · ${who}` : ""}`;
  });
  const more = day.length - lines.length;
  if (more > 0) lines.push(`… et ${more} autre${more > 1 ? "s" : ""}`);
  return lines.join("\n");
}

export function morningTitle(tasks: Task[], weekday: Weekday): string {
  const n = digestTasks(tasks, weekday).length;
  return `Aujourd'hui : ${n} tâche${n > 1 ? "s" : ""}`;
}

export async function syncMorningDigest(tasks: Task[], members: Member[], enabled: boolean, time: string): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => req.identifier?.startsWith(MORNING_ID_PREFIX))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );
  if (!enabled) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(MORNING_CHANNEL, {
      name: "Récap du matin",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});
  }
  const [hour, minute] = time.split(":").map(Number);
  await Promise.all(
    ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map(async (day) => {
      const body = morningBody(tasks, members, day);
      if (!body) return;
      await Notifications.scheduleNotificationAsync({
        identifier: `${MORNING_ID_PREFIX}${day}`,
        content: { title: morningTitle(tasks, day), body, data: { url: "/home" }, priority: Notifications.AndroidNotificationPriority.MAX },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(day), hour, minute, channelId: MORNING_CHANNEL },
      });
    })
  );
}

// ---------------------------------------------------------------------------
// Rendez-vous : notifications à une date précise. Le rappel choisi (1 h avant
// ou la veille à 20 h) et, si le récap du matin est activé, un « Rendez-vous
// aujourd'hui » à l'heure du récap le jour J. Recalculé à chaque changement.

const APPOINTMENT_ID_PREFIX = "rdv:";
const APPOINTMENT_DAY_ID_PREFIX = "rdvday:";
/** Android garde un nombre limité d'alarmes : on ne prévoit que les plus proches. */
const APPOINTMENT_MAX_SCHEDULED = 40;

export interface PlannedNotification {
  identifier: string;
  date: Date;
  title: string;
  body: string;
}

/** Les notifications des rendez-vous à venir, des plus proches aux plus lointaines. */
export function appointmentNotifications(tasks: Task[], members: Member[], morning: { enabled: boolean; time: string }, now: Date = new Date()): PlannedNotification[] {
  const upcoming = tasks.filter((t) => t.appointmentDate && t.appointmentDate >= dayKey(now));
  const planned: PlannedNotification[] = [];
  for (const t of upcoming) {
    const at = remindAt(t, now);
    if (at) planned.push({ identifier: `${APPOINTMENT_ID_PREFIX}${t.id}`, date: at, title: "Rendez-vous", body: reminderText(t) });
  }
  if (morning.enabled) {
    const [h, m] = morning.time.split(":").map(Number);
    const days = [...new Set(upcoming.filter((t) => t.inDigest !== false).map((t) => t.appointmentDate!))];
    for (const day of days) {
      const at = parseDay(day);
      at.setHours(h, m, 0, 0);
      if (at <= now) continue;
      const lines = upcoming
        .filter((t) => t.appointmentDate === day && t.inDigest !== false)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((t) => {
          const who = whoLabel(t.memberIds ?? [], members);
          return `${t.time} ${t.title}${t.location?.trim() ? ` · ${t.location.trim()}` : ""}${who ? ` · ${who}` : ""}`;
        });
      planned.push({ identifier: `${APPOINTMENT_DAY_ID_PREFIX}${day}`, date: at, title: lines.length > 1 ? `${lines.length} rendez-vous aujourd'hui` : "Rendez-vous aujourd'hui", body: lines.join("\n") });
    }
  }
  return planned.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, APPOINTMENT_MAX_SCHEDULED);
}

export async function syncAppointmentNotifications(tasks: Task[], members: Member[], morning: { enabled: boolean; time: string }): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((req) => req.identifier?.startsWith(APPOINTMENT_ID_PREFIX) || req.identifier?.startsWith(APPOINTMENT_DAY_ID_PREFIX))
      .map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );
  await Promise.all(
    appointmentNotifications(tasks, members, morning).map((n) =>
      Notifications.scheduleNotificationAsync({
        identifier: n.identifier,
        content: { title: n.title, body: n.body, data: { url: "/home" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Argent de poche (téléphone de l'enfant) : une notification à 9 h les
// prochains jours de versement. Le versement lui-même est créé par le serveur
// quand le budget est consulté.

const POCKET_ID_PREFIX = "pocket:";
const POCKET_NOTIFY_HOUR = 9;
const POCKET_AHEAD = 4;

/** Les prochains jours de versement à partir de rule.nextDay, à 9 h. */
export function pocketMoneyMoments(rule: Pick<PocketMoneyRule, "frequency" | "day" | "nextDay"> | null, count = POCKET_AHEAD): Date[] {
  if (!rule) return [];
  const out: Date[] = [];
  let d = parseDay(rule.nextDay);
  for (let i = 0; i < count; i++) {
    const at = new Date(d);
    at.setHours(POCKET_NOTIFY_HOUR, 0, 0, 0);
    out.push(at);
    d = rule.frequency === "weekly" ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 12) : new Date(d.getFullYear(), d.getMonth() + 1, rule.day, 12);
  }
  return out;
}

export async function syncPocketMoneyNotifications(rule: PocketMoneyRule | null): Promise<void> {
  if (Platform.OS === "web") return;
  if (!(await hasNotificationPermission())) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((req) => req.identifier?.startsWith(POCKET_ID_PREFIX)).map((req) => Notifications.cancelScheduledNotificationAsync(req.identifier))
  );
  const now = new Date();
  await Promise.all(
    pocketMoneyMoments(rule)
      .filter((at) => at > now)
      .map((at, i) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${POCKET_ID_PREFIX}${i}`,
          content: { title: "Argent de poche", body: `+${formatEuros(rule!.amountCents)} d'argent de poche aujourd'hui !`, data: { url: "/pocket-money" } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        })
      )
  );
}

// ---------------------------------------------------------------------------
// Budget+ trial: one reminder a few days before it ends (see trialReminderDate).

const TRIAL_REMINDER_ID = "trial:budget";

/** Schedules (or cancels, when `endsAt` is null or the moment has passed) the « trial ends soon » reminder. */
export async function syncTrialReminder(endsAt: string | null | undefined): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
  const date = trialReminderDate(endsAt);
  if (!date || !(await hasNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: TRIAL_REMINDER_ID,
    content: {
      title: "Budget+",
      body: `Plus que ${TRIAL_REMINDER_DAYS} jours d'essai gratuit. Pour garder l'import de relevés, l'épargne et le bilan, passe à Budget+.`,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}
