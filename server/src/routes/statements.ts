import express, { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { privateSpace, requireAuth } from "../middleware/auth";
import { statementLimiter } from "../middleware/rateLimits";
import { requireBudgetPack } from "../lib/plan";
import { isValidCategory } from "../lib/expenseCategories";
import { labelKey, parseStatement } from "../lib/statementParser";
import { MAX_STATEMENT_BYTES, StatementReadError, readPdfItems } from "../lib/statementPdf";
import { categorize, looksRecurring } from "../lib/statementCategories";
import { amountCents, currentMonth } from "./expenses";
import { checkDriftAlert } from "../lib/drifts";

// Import of a bank statement (PDF) into the budget — a Budget+ feature.
//   POST /statements/parse   the PDF goes in the request body, is read in
//                            memory and forgotten: nothing is stored, logged or
//                            sent to a third party. Answers the lines found.
//   POST /statements/import  saves the lines the family ticked (and remembers
//                            the categories they corrected).

export const statementsRouter = Router();
statementsRouter.use(requireAuth, privateSpace);

const DAY_MS = 86_400_000;
const DUPLICATE_WINDOW_DAYS = 3;

const budgetGate = async (req: Request, res: Response, next: NextFunction) => {
  if (await requireBudgetPack(req.userId!, res, "L'import de relevés bancaires")) next();
};

statementsRouter.post(
  "/parse",
  budgetGate,
  statementLimiter,
  express.raw({ type: () => true, limit: MAX_STATEMENT_BYTES }),
  async (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length < 100 || body.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return res.status(400).json({ error: "Choisis un relevé au format PDF." });
    }
    const userId = req.userId!;
    try {
      const pages = await readPdfItems(new Uint8Array(body));
      const parsed = parseStatement(pages);
      const debits = parsed.rows.filter((r) => !r.credit);
      const credits = parsed.rows.filter((r) => r.credit);
      if (debits.length === 0) {
        return res.status(422).json({ error: "Aucune dépense trouvée dans ce PDF. Est-ce bien un relevé de compte ?" });
      }

      const learned = new Map((await prisma.importRule.findMany({ where: { userId } })).map((r) => [r.key, r.category]));
      const dates = debits.map((r) => Date.parse(`${r.date}T00:00:00Z`));
      const existing = await prisma.expense.findMany({
        where: {
          userId,
          date: { gte: new Date(Math.min(...dates) - DUPLICATE_WINDOW_DAYS * DAY_MS), lte: new Date(Math.max(...dates) + DUPLICATE_WINDOW_DAYS * DAY_MS) },
        },
        select: { id: true, amountCents: true, date: true },
      });
      const consumed = new Set<string>();

      const rows = debits.map((r, i) => {
        const { category, source } = categorize(r.label, r.detail, learned);
        const day = Date.parse(`${r.date}T00:00:00Z`);
        const twin = existing.find((e) => !consumed.has(e.id) && e.amountCents === r.amountCents && Math.abs(e.date.getTime() - day) <= DUPLICATE_WINDOW_DAYS * DAY_MS);
        if (twin) consumed.add(twin.id);
        return {
          id: i,
          date: r.date,
          label: r.label,
          detail: r.detail,
          kind: r.kind,
          amountCents: r.amountCents,
          category,
          source,
          duplicate: !!twin,
          recurringHint: looksRecurring(r.kind, category, r.label, r.detail),
        };
      });

      const sum = (list: { amountCents: number }[]) => list.reduce((s, r) => s + r.amountCents, 0);
      res.json({
        rows,
        ignoredCredits: { count: credits.length, totalCents: sum(credits) },
        // « Total des opérations » printed on the statement vs what was read: a gap means a line was missed.
        check: {
          readDebitsCents: sum(debits),
          expectedDebitsCents: parsed.expectedDebitsCents,
          ok: parsed.expectedDebitsCents === null ? null : parsed.expectedDebitsCents === sum(debits),
        },
      });
    } catch (e) {
      if (e instanceof StatementReadError) return res.status(422).json({ error: e.message });
      // Never log the error object: it could carry text of the statement.
      console.error("statement parse failed:", e instanceof Error ? e.name : "unknown");
      res.status(500).json({ error: "Impossible de lire ce relevé. Réessaie, ou essaie un autre fichier." });
    }
  },
);

// Body too large / not readable: say it in French instead of the generic error.
statementsRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  const status = (err as { status?: number })?.status;
  if (status === 413) return res.status(413).json({ error: "Ce fichier est trop lourd (6 Mo au plus)." });
  next(err);
});

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        date: dayString,
        label: z.string().trim().min(1).max(90),
        amountCents,
        category: z.string().min(1).max(40),
        /** Create a monthly expense from this line. */
        recurring: z.boolean().default(false),
        /** The family changed the suggested category: remember it for this merchant. */
        learn: z.boolean().default(false),
      }),
    )
    .min(1, "Coche au moins une dépense")
    .max(500, "500 lignes au plus par import"),
});

statementsRouter.post("/import", budgetGate, async (req, res) => {
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const userId = req.userId!;
  const { rows } = parsed.data;

  for (const category of new Set(rows.map((r) => r.category))) {
    if (!(await isValidCategory(userId, category))) return res.status(400).json({ error: "Cette catégorie n'existe plus. Choisis-en une autre." });
  }
  if (rows.some((r) => Number.isNaN(Date.parse(`${r.date}T00:00:00Z`)))) return res.status(400).json({ error: "Cette date n'est pas valable. Choisis-en une autre." });

  const existingRecurring = new Set((await prisma.recurringExpense.findMany({ where: { userId }, select: { label: true } })).map((r) => labelKey(r.label)));

  const result = await prisma.$transaction(async (tx) => {
    let recurringCreated = 0;
    const plain = rows.filter((r) => !r.recurring || existingRecurring.has(labelKey(r.label)));
    const recurring = rows.filter((r) => r.recurring && !existingRecurring.has(labelKey(r.label)));

    if (plain.length) {
      await tx.expense.createMany({ data: plain.map((r) => ({ userId, label: r.label, amountCents: r.amountCents, category: r.category, date: new Date(`${r.date}T00:00:00Z`) })) });
    }
    for (const r of recurring) {
      const month = r.date.slice(0, 7);
      const template = await tx.recurringExpense.create({
        data: { userId, label: r.label, amountCents: r.amountCents, category: r.category, dayOfMonth: Number(r.date.slice(8, 10)), startMonth: month },
      });
      // The month is already on the statement: mark it done so it isn't copied a second time.
      await tx.recurringRun.create({ data: { recurringId: template.id, month } });
      await tx.expense.create({ data: { userId, label: r.label, amountCents: r.amountCents, category: r.category, date: new Date(`${r.date}T00:00:00Z`), recurringId: template.id } });
      recurringCreated++;
      existingRecurring.add(labelKey(r.label));
    }

    let rulesLearned = 0;
    for (const r of rows.filter((x) => x.learn)) {
      const key = labelKey(r.label);
      if (!key) continue;
      await tx.importRule.upsert({ where: { userId_key: { userId, key } }, update: { category: r.category }, create: { userId, key, category: r.category } });
      rulesLearned++;
    }
    return { recurringCreated, rulesLearned };
  });

  // Dérives (Budget+) : seulement pour le mois en cours, les mois passés sont de l'historique.
  const month = currentMonth();
  for (const category of new Set(rows.filter((r) => r.date.startsWith(month)).map((r) => r.category))) {
    await checkDriftAlert(userId, category, month, req.accountId!);
  }
  res.status(201).json({ imported: rows.length, ...result });
});
