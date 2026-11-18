import type { Task, Weekday } from "../api/types";
import { weekKey } from "./stars";

// Rendez-vous : une tâche avec une date précise (« AAAA-MM-JJ »). Les autres
// tâches forment la semaine type et s'affichent toutes les semaines.

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Un rappel la veille part à cette heure. */
export const EVE_REMINDER_TIME = "20:00";

export const isAppointment = (t: Pick<Task, "appointmentDate">) => !!t.appointmentDate;

const pad = (n: number) => String(n).padStart(2, "0");

/** « AAAA-MM-JJ » en heure locale. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midi local du jour (évite les surprises du changement d'heure). */
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: string, n: number): string {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Lundi de la semaine décalée de `n` semaines. */
export const shiftWeek = (week: string, n: number) => addDays(week, 7 * n);

/** Lundi de la semaine qui contient ce jour. */
export const weekOfDay = (day: string) => weekKey(parseDay(day));

/** 0 = lundi … 6 = dimanche. */
export const weekdayOfDay = (day: string) => ((parseDay(day).getDay() + 6) % 7) as Weekday;

/** Une tâche de la semaine type a lieu chaque semaine ; un rendez-vous seulement dans la sienne. */
export function inWeek(task: Pick<Task, "appointmentDate">, week: string): boolean {
  return !task.appointmentDate || weekOfDay(task.appointmentDate) === week;
}

/** Ce qui a lieu ce jour-là de cette semaine, dans l'ordre de l'heure. */
export function tasksOn<T extends Pick<Task, "appointmentDate" | "weekday" | "time">>(tasks: T[], weekday: Weekday, week: string): T[] {
  return tasks.filter((t) => t.weekday === weekday && inWeek(t, week)).sort((a, b) => a.time.localeCompare(b.time));
}

/** « 3 déc. » */
export function shortDate(day: string): string {
  const d = parseDay(day);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** « jeu. 3 déc. » */
export function appointmentDayLabel(day: string): string {
  return `${DAYS[weekdayOfDay(day)]} ${shortDate(day)}`;
}

/** « Cette semaine », « Semaine prochaine », « Semaine dernière » ou « Semaine du 23 nov. » */
export function weekTitle(week: string, current: string = weekKey()): string {
  if (week === current) return "Cette semaine";
  if (week === shiftWeek(current, 1)) return "Semaine prochaine";
  if (week === shiftWeek(current, -1)) return "Semaine dernière";
  return `Semaine du ${shortDate(week)}`;
}

/** « 16 – 22 nov. » ou « 30 nov. – 6 déc. » */
export function weekRange(week: string): string {
  const start = parseDay(week);
  const end = parseDay(addDays(week, 6));
  return start.getMonth() === end.getMonth() ? `${start.getDate()} – ${shortDate(addDays(week, 6))}` : `${shortDate(week)} – ${shortDate(addDays(week, 6))}`;
}

/** Moment du rappel d'un rendez-vous, ou null (pas de rappel, ou déjà passé). */
export function remindAt(task: Pick<Task, "appointmentDate" | "time" | "remind">, now: Date = new Date()): Date | null {
  if (!task.appointmentDate || !task.remind) return null;
  const [h, m] = task.time.split(":").map(Number);
  const start = parseDay(task.appointmentDate);
  start.setHours(h, m, 0, 0);
  let at: Date;
  if (task.remind === "hour") {
    at = new Date(start.getTime() - 60 * 60_000);
  } else {
    const [eh, em] = EVE_REMINDER_TIME.split(":").map(Number);
    at = parseDay(addDays(task.appointmentDate, -1));
    at.setHours(eh, em, 0, 0);
  }
  return at > now ? at : null;
}

/** Texte du rappel : « Demain 14:30 · Dentiste (Cabinet Dupont) ». */
export function reminderText(task: Pick<Task, "title" | "time" | "location" | "remind">): string {
  const where = task.location?.trim() ? ` (${task.location.trim()})` : "";
  return `${task.remind === "eve" ? "Demain" : "Dans 1 h"} ${task.time} · ${task.title}${where}`;
}
