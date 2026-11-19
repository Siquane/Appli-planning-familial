// Page web publique du lien de partage d'un membre : sa semaine jour par jour.
// Rendue côté serveur en HTML simple (aucun compte ni appli nécessaire).

import { addDays } from "./cervelle/days";
import { de } from "./elision";

export interface ShareTask {
  title: string;
  category: string;
  weekday: number;
  time: string;
  duration: number;
  appointmentDate: string | null;
  location: string;
}

export interface SharePageInput {
  memberName: string;
  /** Lundi affiché, « AAAA-MM-JJ ». */
  week: string;
  /** Aujourd'hui (heure de Paris), « AAAA-MM-JJ ». */
  today: string;
  tasks: ShareTask[];
  /** Adresse de la page sans paramètre, pour les liens semaine précédente / suivante. */
  selfPath: string;
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const CATEGORY_COLORS: Record<string, string> = {
  École: "#3FB8FF",
  Travail: "#9B5CFF",
  Maison: "#22E5FF",
  Santé: "#FF6B9A",
  Loisirs: "#FFC24B",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function shortDate(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function endTime(time: string, duration: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + duration) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Ce qui a lieu ce jour-là de la semaine : la semaine type, plus les rendez-vous datés de ce jour. */
export function tasksOfDay(tasks: ShareTask[], week: string, weekday: number): ShareTask[] {
  const day = addDays(week, weekday);
  return tasks
    .filter((t) => (t.appointmentDate ? t.appointmentDate === day : t.weekday === weekday))
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function weekTitle(week: string, today: string): string {
  const current = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7));
  if (week === current) return "Cette semaine";
  if (week === addDays(current, 7)) return "Semaine prochaine";
  if (week === addDays(current, -7)) return "Semaine dernière";
  return `Semaine du ${shortDate(week)}`;
}

export function renderSharePage({ memberName, week, today, tasks, selfPath }: SharePageInput): string {
  const name = escapeHtml(memberName);
  const days = DAYS.map((label, weekday) => {
    const day = addDays(week, weekday);
    const list = tasksOfDay(tasks, week, weekday);
    const items = list.length
      ? list
          .map((t) => {
            const tint = CATEGORY_COLORS[t.category] ?? "#3FB8FF";
            const rdv = t.appointmentDate ? `<span class="tag">Rendez-vous</span>` : "";
            const where = t.appointmentDate && t.location.trim() ? `<div class="where">📍 ${escapeHtml(t.location.trim())}</div>` : "";
            return `<li style="--tint:${tint}"><div class="time">${t.time}<small>${endTime(t.time, t.duration)}</small></div><div class="what"><div class="title">${escapeHtml(t.title)}</div><div class="meta">${rdv}<span class="cat">${escapeHtml(t.category)}</span></div>${where}</div></li>`;
          })
          .join("")
      : `<li class="empty">Rien de prévu</li>`;
    const isToday = day === today;
    return `<section class="day${isToday ? " today" : ""}"><h2>${label} <span>${shortDate(day)}</span>${isToday ? `<em>Aujourd'hui</em>` : ""}</h2><ul>${items}</ul></section>`;
  }).join("");

  const nav = (target: string, label: string, aria: string) => `<a href="${escapeHtml(selfPath)}?week=${target}" aria-label="${aria}">${label}</a>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Planning ${de(name)} · Passerelle</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#070912;--card:#0F1426;--line:#1E2740;--text:#E8F4FF;--muted:#8E9BB8;--cyan:#22E5FF;--blue:#3FB8FF;--violet:#9B5CFF}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 Inter,system-ui,sans-serif}
main{max-width:640px;margin:0 auto;padding:24px 16px 48px}
.brand{font:600 13px "Space Grotesk",sans-serif;letter-spacing:.18em;background:linear-gradient(90deg,var(--cyan),var(--blue),var(--violet));-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font:600 26px/1.2 "Space Grotesk",sans-serif;margin:6px 0 18px}
.weeknav{display:flex;align-items:center;gap:8px;margin-bottom:18px}
.weeknav a{color:var(--text);text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 14px;font-size:18px}
.weeknav .label{flex:1;text-align:center}
.weeknav .label b{display:block;font:600 15px "Space Grotesk",sans-serif}
.weeknav .label span{color:var(--muted);font-size:12px}
.back{display:block;text-align:center;color:var(--cyan);font-size:13px;margin:-8px 0 16px;text-decoration:none}
.day{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:12px}
.day.today{border-color:var(--cyan);box-shadow:0 0 0 1px rgba(34,229,255,.25)}
h2{font:600 15px "Space Grotesk",sans-serif;margin:0 0 10px;display:flex;align-items:baseline;gap:8px}
h2 span{color:var(--muted);font:400 13px Inter,sans-serif}
h2 em{margin-left:auto;font:500 11px Inter,sans-serif;font-style:normal;color:var(--bg);background:var(--cyan);border-radius:999px;padding:2px 8px}
ul{list-style:none;margin:0;padding:0}
li{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--line)}
li:first-child{border-top:0;padding-top:0}
li.empty{color:var(--muted);font-size:13px}
.time{width:52px;flex:none;font:500 14px ui-monospace,monospace;border-left:3px solid var(--tint);padding-left:8px}
.time small{display:block;color:var(--muted);font-size:11px}
.title{font-weight:500}
.meta{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}
.cat,.tag{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--line);color:var(--muted)}
.tag{border-color:var(--violet);color:#C9AEFF}
.where{color:var(--muted);font-size:13px;margin-top:4px}
footer{color:var(--muted);font-size:12px;text-align:center;margin-top:24px}
</style>
</head>
<body>
<main>
<div class="brand">PASSERELLE</div>
<h1>Planning ${de(name)}</h1>
<div class="weeknav">
${nav(addDays(week, -7), "‹", "Semaine précédente")}
<div class="label"><b>${weekTitle(week, today)}</b><span>${shortDate(week)} – ${shortDate(addDays(week, 6))}</span></div>
${nav(addDays(week, 7), "›", "Semaine suivante")}
</div>
${weekTitle(week, today) === "Cette semaine" ? "" : `<a class="back" href="${escapeHtml(selfPath)}">Revenir à cette semaine</a>`}
${days}
<footer>Mis à jour à chaque ouverture de la page. Lien privé : ne le partage qu'avec des personnes de confiance.</footer>
</main>
</body>
</html>`;
}
