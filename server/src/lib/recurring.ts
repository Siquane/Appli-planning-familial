import { Prisma } from "@prisma/client";
import { prisma } from "../db";

/** Last day of a "YYYY-MM" month (28–31). */
export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The calendar day a recurring expense lands on in `month`: day 31 becomes the 30th in April, the 28th/29th in February. */
export function occurrenceDate(month: string, dayOfMonth: number) {
  const day = Math.min(dayOfMonth, daysInMonth(month));
  return new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
}

/**
 * Copies every recurring expense due in `month` into a real Expense, once.
 * Runs lazily when a month is read (no scheduler on the free hosting plan).
 * Months after `currentMonth` are left alone so a later edit of the template
 * isn't contradicted by copies made in advance.
 */
export async function materializeRecurring(userId: string, month: string, currentMonth: string) {
  if (month > currentMonth) return;
  const due = await prisma.recurringExpense.findMany({
    where: { userId, startMonth: { lte: month }, runs: { none: { month } } },
  });
  for (const r of due) {
    try {
      await prisma.$transaction([
        prisma.recurringRun.create({ data: { recurringId: r.id, month } }),
        prisma.expense.create({
          data: {
            userId,
            label: r.label,
            amountCents: r.amountCents,
            category: r.category,
            memberId: r.memberId,
            recurringId: r.id,
            date: occurrenceDate(month, r.dayOfMonth),
          },
        }),
      ]);
    } catch (e) {
      // Another request generated this month at the same moment: nothing to do.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}
