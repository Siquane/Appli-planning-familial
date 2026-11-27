import type { NextFunction, Request, Response, Router } from "express";
import { prisma } from "../db";

// « Ce que coûte l'IA » : for the parent, what Cervelle's AI calls really cost
// this month (or another), per kind and per child. Rows recorded before the
// meter existed count as calls with no known cost.

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const USAGE_KINDS = ["revision", "exam", "assistant", "grading", "timetable", "homework", "brevet", "dictation", "mindmap"] as const;

function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}

export function mountUsage(router: Router, d: { parentOnly: (req: Request, res: Response, next: NextFunction) => unknown }) {
  router.get("/usage", d.parentOnly, async (req, res) => {
    const familyId = req.cervelle!.familyId;
    const current = new Date().toISOString().slice(0, 7);
    const asked = String(req.query.month ?? "");
    const month = MONTH.test(asked) && asked <= current ? asked : current;
    const { from, to } = monthBounds(month);
    const [rows, learners] = await Promise.all([
      prisma.aiUsage.groupBy({
        by: ["kind", "learnerId"],
        where: { userId: familyId, kind: { in: [...USAGE_KINDS] }, createdAt: { gte: from, lt: to } },
        _count: true,
        _sum: { costMicros: true, inputTokens: true, outputTokens: true },
      }),
      prisma.learner.findMany({ where: { userId: familyId }, select: { id: true, name: true } }),
    ]);
    // Calls measured (cost known) vs older ones, to compute a fair average.
    const measured = await prisma.aiUsage.groupBy({
      by: ["kind"],
      where: { userId: familyId, kind: { in: [...USAGE_KINDS] }, createdAt: { gte: from, lt: to }, costMicros: { gt: 0 } },
      _count: true,
    });
    const measuredOf = new Map(measured.map((m) => [m.kind, m._count]));
    const byKind = USAGE_KINDS.map((kind) => {
      const of = rows.filter((r) => r.kind === kind);
      const calls = of.reduce((n, r) => n + r._count, 0);
      const micros = of.reduce((n, r) => n + (r._sum.costMicros ?? 0), 0);
      const known = measuredOf.get(kind) ?? 0;
      return { kind, calls, measured: known, cost: micros / 1e6, average: known ? micros / 1e6 / known : null, outputTokens: of.reduce((n, r) => n + (r._sum.outputTokens ?? 0), 0) };
    }).filter((k) => k.calls > 0);
    const byLearner = learners
      .map((l) => {
        const of = rows.filter((r) => r.learnerId === l.id);
        return { id: l.id, name: l.name, calls: of.reduce((n, r) => n + r._count, 0), cost: of.reduce((n, r) => n + (r._sum.costMicros ?? 0), 0) / 1e6 };
      })
      .filter((l) => l.calls > 0);
    res.json({ month, total: byKind.reduce((n, k) => n + k.cost, 0), byKind, byLearner });
  });
}
