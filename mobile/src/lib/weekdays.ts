import { color } from "../theme/tokens";
import type { Weekday } from "../api/types";

// 0=Lun ... 6=Dim — matches the server's convention (app/server/src/lib/dates.ts).
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] as const;
export const WEEKDAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;

export function jsDayToWeekday(jsDay: number): Weekday {
  return (((jsDay + 6) % 7) as Weekday);
}

export function todayWeekday(): Weekday {
  return jsDayToWeekday(new Date().getDay());
}

// Each task category takes one of the logo's ring colours; Santé gets the
// neon green so it stays distinct from the 4 tab colours.
export function categoryColor(category: string): string {
  switch (category) {
    case "École":
      return color.pillar1;
    case "Travail":
      return color.pillar2;
    case "Maison":
      return color.pillar3;
    case "Loisirs":
      return color.pillar4;
    case "Santé":
      return color.success;
    default:
      return color.neutral400;
  }
}

export function priorityLabel(priority: string): string {
  switch (priority) {
    case "high":
      return "Priorité haute";
    case "medium":
      return "Priorité moyenne";
    default:
      return "Priorité basse";
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Jour « AAAA-MM-JJ » d'un jour de la semaine (0 = lundi), à partir du lundi « AAAA-MM-JJ ». */
export function dayOfWeek(week: string, weekday: Weekday): string {
  const [y, m, d] = week.split("-").map(Number);
  const day = new Date(y, m - 1, d + weekday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** Petite phrase pour l'anneau du jour. */
export function progressLine(done: number, total: number): { title: string; detail: string } {
  if (total === 0) return { title: "Journée libre", detail: "Rien de prévu." };
  const left = total - done;
  if (left === 0) return { title: "Tout est fait !", detail: "Bravo la famille." };
  if (done === 0) return { title: "C'est parti", detail: `${total} tâche${total > 1 ? "s" : ""} au programme.` };
  if (done / total >= 0.5) return { title: "Belle lancée !", detail: `Plus que ${left} tâche${left > 1 ? "s" : ""}.` };
  return { title: "Bon début", detail: `Encore ${left} tâche${left > 1 ? "s" : ""}.` };
}
