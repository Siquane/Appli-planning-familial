import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { prisma } from "../db";
import { removeObjects } from "../lib/storage";
import { euros } from "../lib/splits";
import { pushToAccounts } from "../lib/familyAlerts";
import { renderSplitPage } from "../lib/splitPage";
import { expenseSchema, groupInclude, photoUpload, prepare, serializeGroup, type FullGroup } from "./splits";

// Lien d'une personne d'un groupe de comptes partagés (« Partager le lien »
// dans l'appli) : une page web, sans compte ni appli, où elle voit le groupe
// et ce qu'elle doit, ajoute ses dépenses et modifie celles qu'elle a ajoutées.
// Le secret du lien est la seule clé : un lien coupé cesse de marcher.
export const splitsPublicRouter = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.DISABLE_RATE_LIMIT === "1",
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: { error: "Trop de demandes. Réessaie dans une minute." },
});
splitsPublicRouter.use(limiter);
splitsPublicRouter.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Referrer-Policy", "no-referrer");
  next();
});

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/** La personne du lien et son groupe, ou null (la réponse est envoyée). */
async function resolve(req: Request, res: Response): Promise<{ me: FullGroup["participants"][number]; g: FullGroup } | null> {
  const token = String(req.params.token);
  const me = TOKEN.test(token) ? await prisma.splitParticipant.findUnique({ where: { linkToken: token } }) : null;
  const g = me ? await prisma.splitGroup.findUnique({ where: { id: me.groupId }, include: groupInclude }) : null;
  if (!me || !g) {
    res.status(404).json({ error: "Ce lien n'est plus valable. Demande un nouveau lien." });
    return null;
  }
  return { me, g };
}

async function reload(id: string) {
  return (await prisma.splitGroup.findUnique({ where: { id }, include: groupInclude }))!;
}

async function view(meId: string, g: FullGroup) {
  return { me: meId, group: await serializeGroup(g, true, false) };
}

/** Prévient les comptes de la famille qu'une personne de l'extérieur a ajouté une dépense. */
async function notifyFamily(g: FullGroup, who: string, title: string, amountCents: number) {
  const accounts = await prisma.user.findMany({ where: { OR: [{ id: g.userId }, { familyOwnerId: g.userId }] }, select: { id: true } });
  await pushToAccounts(
    accounts.map((a) => a.id),
    `${who} a ajouté « ${title} » : ${euros(amountCents)} (${g.name})`,
    `/comptes/${g.id}`,
  );
}

splitsPublicRouter.get("/:token", async (req, res) => {
  const token = String(req.params.token);
  const ok = TOKEN.test(token) && !!(await prisma.splitParticipant.findUnique({ where: { linkToken: token }, select: { id: true } }));
  res.status(ok ? 200 : 404).type("html").send(renderSplitPage(ok ? token : null));
});

splitsPublicRouter.get("/:token/data", async (req, res) => {
  const r = await resolve(req, res);
  if (!r) return;
  res.json(await view(r.me.id, r.g));
});

splitsPublicRouter.post("/:token/expenses", async (req, res) => {
  const r = await resolve(req, res);
  if (!r) return;
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const shares = prepare(res, r.g, d);
  if (!shares) return;
  const photo = await photoUpload(res, r.g.userId, d.photo);
  if (!photo) return;
  await prisma.splitExpense.create({
    data: {
      groupId: r.g.id,
      title: d.title,
      amountCents: d.amountCents,
      paidById: d.paidById,
      date: new Date(`${d.date}T00:00:00Z`),
      mode: d.mode,
      photoKey: photo.key,
      photoMime: photo.mime,
      addedById: r.me.id,
      shares: { create: shares },
    },
  });
  await prisma.splitGroup.update({ where: { id: r.g.id }, data: { updatedAt: new Date() } });
  notifyFamily(r.g, r.me.name, d.title, d.amountCents).catch((e) => console.error("Split push failed:", e));
  res.status(201).json({ upload: photo.upload, ...(await view(r.me.id, await reload(r.g.id))) });
});

/** Seulement une dépense que cette personne a ajoutée elle-même. */
function ownExpense(r: { me: { id: string }; g: FullGroup }, eid: string) {
  return r.g.expenses.find((e) => e.id === eid && e.addedById === r.me.id) ?? null;
}

splitsPublicRouter.put("/:token/expenses/:eid", async (req, res) => {
  const r = await resolve(req, res);
  if (!r) return;
  const existing = ownExpense(r, String(req.params.eid));
  if (!existing) return res.status(403).json({ error: "Tu ne peux modifier que les dépenses que tu as ajoutées." });
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const d = parsed.data;
  const shares = prepare(res, r.g, d);
  if (!shares) return;
  const photo = d.photo ? await photoUpload(res, r.g.userId, d.photo) : { key: existing.photoKey, mime: existing.photoMime, upload: null };
  if (!photo) return;
  await prisma.$transaction([
    prisma.splitShare.deleteMany({ where: { expenseId: existing.id } }),
    prisma.splitExpense.update({
      where: { id: existing.id },
      data: { title: d.title, amountCents: d.amountCents, paidById: d.paidById, date: new Date(`${d.date}T00:00:00Z`), mode: d.mode, photoKey: photo.key, photoMime: photo.mime, shares: { create: shares } },
    }),
  ]);
  if (d.photo && existing.photoKey) await removeObjects([existing.photoKey]).catch(() => undefined);
  res.json({ upload: photo.upload, ...(await view(r.me.id, await reload(r.g.id))) });
});

splitsPublicRouter.delete("/:token/expenses/:eid", async (req, res) => {
  const r = await resolve(req, res);
  if (!r) return;
  const existing = ownExpense(r, String(req.params.eid));
  if (!existing) return res.status(403).json({ error: "Tu ne peux supprimer que les dépenses que tu as ajoutées." });
  await prisma.splitExpense.delete({ where: { id: existing.id } });
  if (existing.photoKey) await removeObjects([existing.photoKey]).catch(() => undefined);
  res.json(await view(r.me.id, await reload(r.g.id)));
});
