import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../db";
import { prideOf } from "./cervelleLearn";

// Page publique du « journal de fierté » d'une semaine (GET /f/:token) : le
// lien que l'enfant partage (grands-parents…). Prénom seulement, pas de
// note, ce que l'enfant a appris et ce dont il est fier. Sans compte.
export const pridePublicRouter = Router();

pridePublicRouter.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.DISABLE_RATE_LIMIT === "1",
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  }),
);

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

type Pride = Awaited<ReturnType<typeof prideOf>>;

export function renderPridePage(p: Pride | null): string {
  const head = (title: string) =>
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#F3F6FB"><title>${esc(title)}</title>
<style>
:root{--bg:#F3F6FB;--card:#FFFFFF;--ink:#1F1A3D;--muted:#5B5675;--brand:#D6336C;--teal:#0B7F74;--sun:#FFC23D;--line:#E3E8F2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:17px;line-height:1.45}
main{max-width:560px;margin:0 auto;padding:24px 16px 60px}
.hero{background:linear-gradient(135deg,#FF5C8A,#9B5CFF);color:#fff;border-radius:24px;padding:24px 20px;text-align:center}
.hero h1{margin:6px 0 4px;font-size:26px}.hero p{margin:0;opacity:.95}
.stats{display:flex;gap:8px;margin:14px 0}.stat{flex:1;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px;text-align:center}
.stat b{display:block;font-size:24px;color:var(--teal)}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin:10px 0}
h2{font-size:18px;margin:0 0 8px}ul{margin:0;padding-left:20px}li{margin:4px 0}.day{color:var(--muted);font-size:14px}
.msg{border-left:4px solid var(--sun);font-style:italic}.foot{color:var(--muted);font-size:13px;text-align:center;margin-top:24px}
</style></head><body><main>`;
  if (!p) return `${head("Lien expiré")}<div class="card"><p>Ce lien n'est plus valable.</p></div></main></body></html>`;
  const first = esc(p.name.trim().split(/\s+/)[0] || p.name);
  const list = (items: { day: string; text: string }[]) => `<ul>${items.map((i) => `<li>${esc(i.text)} <span class="day">· ${dayLabel(i.day)}</span></li>`).join("")}</ul>`;
  return `${head(`Le journal de fierté de ${p.name}`)}
<div class="hero"><div style="font-size:40px">🌟</div><h1>Le journal de fierté de ${first}</h1><p>Semaine du ${dayLabel(p.week)} au ${dayLabel(p.to)}</p></div>
<div class="stats"><div class="stat"><b>${p.activeDays}</b>jour${p.activeDays > 1 ? "s" : ""} de travail</div><div class="stat"><b>${p.notions.length}</b>notion${p.notions.length > 1 ? "s" : ""} apprise${p.notions.length > 1 ? "s" : ""}</div><div class="stat"><b>${p.minutes}</b>minutes</div></div>
${p.message ? `<div class="card msg">« ${esc(p.message)} »</div>` : ""}
${p.notions.length ? `<div class="card"><h2>Ce que ${first} a appris</h2><ul>${p.notions.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
${p.learned.length ? `<div class="card"><h2>Dans son journal : « j'ai appris… »</h2>${list(p.learned)}</div>` : ""}
${p.proud.length ? `<div class="card"><h2>Ce dont ${first} est fier</h2>${list(p.proud)}</div>` : ""}
${p.badges.length ? `<div class="card"><h2>Badges gagnés</h2><ul>${p.badges.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div>` : ""}
<p class="foot">Fait avec Cervelle, l'appli de révision.</p>
</main></body></html>`;
}

pridePublicRouter.get("/:token", async (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Referrer-Policy", "no-referrer");
  const token = String(req.params.token);
  const share = TOKEN.test(token) ? await prisma.prideShare.findUnique({ where: { token }, include: { learner: true } }) : null;
  res.type("html");
  if (!share) return res.status(404).send(renderPridePage(null));
  res.send(renderPridePage(await prideOf(share.learner, share.week)));
});
