import type { Expense, ExpenseInput, Meal, MealInput, MonthlyBudget, ShoppingItem, Task, TaskInput, Weekday } from "../api/types";

// What the screens show right away for a change made without a connection:
// the cached lists, edited as the server would edit them. They are replaced by
// the server's own answer once the change has been sent.

/** The date of `weekday` in the week containing `now` (0 = Monday), as the server computes it. */
export function dateForWeekday(weekday: Weekday, now: Date = new Date()): string {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + weekday);
  return monday.toISOString();
}

export function taskFromInput(id: string, input: TaskInput, now: Date = new Date()): Task {
  return {
    duration: 30,
    priority: "medium",
    deadlineWeekday: null,
    recurring: false,
    reminder: false,
    flexible: false,
    synced: false,
    notes: "",
    memberIds: [],
    seriesId: null,
    stars: 1,
    inDigest: true,
    appointmentDate: null,
    location: "",
    remind: null,
    ...input,
    id,
    date: dateForWeekday(input.weekday, now),
    externalProvider: null,
  };
}

export function patchTask(task: Task, data: Partial<TaskInput>, now: Date = new Date()): Task {
  const next = { ...task, ...data } as Task;
  return data.weekday !== undefined ? { ...next, date: dateForWeekday(data.weekday, now) } : next;
}

export const shoppingItemFor = (id: string, label: string, now: Date = new Date()): ShoppingItem => ({
  id,
  label,
  checked: false,
  fromMenu: false,
  createdAt: now.toISOString(),
});

/** A slot holds one meal: setting it replaces what was there. */
export function setMealIn(meals: Meal[], id: string, data: MealInput): Meal[] {
  const previous = meals.find((m) => m.weekday === data.weekday && m.type === data.type);
  const meal: Meal = {
    title: "",
    recipeId: null,
    notes: "",
    ingredients: [],
    ...(previous ?? {}),
    ...data,
    week: data.week ?? previous?.week ?? "",
    id: previous?.id ?? id,
  } as Meal;
  return previous ? meals.map((m) => (m === previous ? meal : m)) : [...meals, meal];
}

const sameMonth = (month: string, date: string) => date.slice(0, 7) === month;

/** Adds an expense to a month's view, and to the totals. Ignored when the expense falls in another month. */
export function addExpenseTo(budget: MonthlyBudget, expense: Expense): MonthlyBudget {
  if (!sameMonth(budget.month, expense.date)) return budget;
  const known = budget.byCategory.some((c) => c.category === expense.category);
  const byCategory = known
    ? budget.byCategory.map((c) => (c.category === expense.category ? { ...c, totalCents: c.totalCents + expense.amountCents } : c))
    : [...budget.byCategory, { category: expense.category, totalCents: expense.amountCents, limitCents: null }];
  return { ...budget, totalCents: budget.totalCents + expense.amountCents, byCategory, expenses: [expense, ...budget.expenses] };
}

export function removeExpenseFrom(budget: MonthlyBudget, id: string): MonthlyBudget {
  const gone = budget.expenses.find((e) => e.id === id);
  if (!gone) return budget;
  return {
    ...budget,
    totalCents: budget.totalCents - gone.amountCents,
    byCategory: budget.byCategory.map((c) => (c.category === gone.category ? { ...c, totalCents: c.totalCents - gone.amountCents } : c)),
    expenses: budget.expenses.filter((e) => e.id !== id),
  };
}

export const expenseFromInput = (id: string, input: ExpenseInput, now: Date = new Date()): Expense => ({
  ...input,
  id,
  recurringId: null,
  goalId: null,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
});
