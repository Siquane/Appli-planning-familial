import type { Weekday } from "../api/types";
import { formatEuros } from "../lib/money";
import { jsDayToWeekday, WEEKDAYS_FULL } from "../lib/weekdays";
import { nowTime } from "../lib/today";
import type { WidgetSnapshot } from "./snapshot";

// Plain text for each widget, kept apart from the drawing so it can be tested.

export interface WidgetRow {
  text: string;
  /** Dimmed (past task) or highlighted (next task / over budget). */
  tone?: "faint" | "strong" | "danger";
  /** Shown at the right end of the row: who the task is for. */
  aside?: string;
}

export interface WidgetContent {
  title: string;
  rows: WidgetRow[];
  empty?: string;
  /** Shown dimmed, labelled « Exemple », while there's nothing real to show. */
  example?: string[];
}

function monthOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function summaryContent(s: WidgetSnapshot, now: Date): WidgetContent {
  const today = jsDayToWeekday(now.getDay());
  const time = nowTime(now);
  const todays = s.tasks.filter((t) => t.weekday === today).sort((a, b) => a.time.localeCompare(b.time));
  const next = todays.find((t) => t.time >= time);
  const n = `${todays.length} tâche${todays.length > 1 ? "s" : ""}`;
  const taskLine = todays.length === 0 ? "Rien de prévu aujourd'hui" : next ? `${next.time} ${next.title}` : `${n} · journée terminée`;
  const dinner = s.dinners.find((d) => d.weekday === today);
  const rows: WidgetRow[] = [
    { text: taskLine, tone: next ? "strong" : undefined, aside: next?.who || undefined },
    { text: dinner ? `Ce soir : ${dinner.title}` : "Dîner pas encore prévu" },
  ];
  const b = s.budget && s.budget.month === monthOf(now) ? s.budget : null;
  if (b) {
    const left = b.capCents !== null ? b.capCents - b.spentCents : null;
    rows.push(
      left === null
        ? { text: `${formatEuros(b.spentCents)} dépensés ce mois-ci` }
        : left >= 0
          ? { text: `Reste ${formatEuros(left)} ce mois-ci` }
          : { text: `Plafonds dépassés de ${formatEuros(-left)}`, tone: "danger" },
    );
  }
  const nothing = todays.length === 0 && !dinner && (!b || b.spentCents === 0);
  return nothing
    ? { title: "Aujourd'hui", rows: [], empty: "Rien de prévu pour l'instant", example: ["17:00 Piscine", "Ce soir : Gratin de pâtes", "Reste 320,00 € ce mois-ci"] }
    : { title: "Aujourd'hui", rows };
}

export function tasksContent(s: WidgetSnapshot, now: Date, max = 6): WidgetContent {
  const today = jsDayToWeekday(now.getDay());
  const time = nowTime(now);
  const todays = s.tasks.filter((t) => t.weekday === today).sort((a, b) => a.time.localeCompare(b.time));
  // Keep the upcoming ones in view when the day is busy.
  const firstUpcoming = Math.max(0, todays.findIndex((t) => t.time >= time));
  const start = todays.every((t) => t.time < time) ? Math.max(0, todays.length - max) : Math.min(firstUpcoming, Math.max(0, todays.length - max));
  const shown = todays.slice(start, start + max);
  const nextTask = todays.find((t) => t.time >= time);
  return {
    title: `${WEEKDAYS_FULL[today]} · ${todays.length} tâche${todays.length > 1 ? "s" : ""}`,
    rows: shown.map((t) => ({
      text: `${t.time}  ${t.title}`,
      tone: t === nextTask ? "strong" : t.time < time ? "faint" : undefined,
      aside: t.who || undefined,
    })),
    empty: "Rien de prévu aujourd'hui",
    example: ["08:30  École · Léa", "17:00  Piscine · Tom", "19:30  Devoirs"],
  };
}

export function menuContent(s: WidgetSnapshot, now: Date, days = 4): WidgetContent {
  const today = jsDayToWeekday(now.getDay());
  const rows: WidgetRow[] = [];
  // The menu is for the current week (Lun..Dim): from today to Sunday.
  for (let w = today; w <= 6 && rows.length < days; w++) {
    const dinner = s.dinners.find((d) => d.weekday === w);
    const label = w === today ? "Ce soir" : WEEKDAYS_FULL[w as Weekday];
    rows.push({ text: `${label} : ${dinner ? dinner.title : "—"}`, tone: w === today ? "strong" : undefined });
  }
  if (!rows.some((r) => !r.text.endsWith(": —"))) {
    return { title: "Menu de la semaine", rows: [], empty: "Menu pas encore prévu", example: ["Ce soir : Gratin de pâtes", "Demain : Soupe et tartines", "Puis : Poulet rôti"] };
  }
  return { title: "Menu de la semaine", rows };
}

export function shoppingContent(s: WidgetSnapshot, max = 7): WidgetContent {
  const rows: WidgetRow[] = s.shopping.slice(0, max).map((label) => ({ text: `•  ${label}` }));
  if (s.shopping.length > max) rows.push({ text: `+ ${s.shopping.length - max} autre${s.shopping.length - max > 1 ? "s" : ""}`, tone: "faint" });
  return { title: `Courses · ${s.shopping.length}`, rows, empty: "Liste de courses vide", example: ["•  Lait", "•  Pain", "•  Pommes"] };
}
