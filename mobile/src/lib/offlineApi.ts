import { expensesApi, mealsApi, shoppingApi, tasksApi } from "../api/resources";
import type { CapAlert, DriftAlert, Expense, ExpenseInput, Meal, MealInput, MonthlyBudget, ShoppingItem, Task, TaskInput } from "../api/types";
import { queryClient } from "./queryClient";
import { newTempId } from "./outboxQueue";
import { writeOrQueue } from "./outbox";
import { addExpenseTo, expenseFromInput, patchTask, removeExpenseFrom, setMealIn, shoppingItemFor, taskFromInput } from "./offlinePatches";

// The writes that keep working without a connection: tasks, shopping list,
// menu and expenses. Same answers as the plain API calls; offline, the screen
// is updated at once and the change is sent later (src/lib/outbox.ts).
// Everything else (recipes, documents, family…) needs the network.

const qc = queryClient;

export const offlineTasks = {
  create: (data: TaskInput) => {
    const tempId = newTempId();
    return writeOrQueue<{ task: Task }>({
      entity: "tasks",
      method: "POST",
      path: "/tasks",
      body: data,
      tempId,
      foldable: true,
      send: () => tasksApi.create(data),
      queuedResult: () => ({ task: taskFromInput(tempId, data) }),
      applyToCache: () => qc.setQueryData<Task[]>(["tasks"], (list) => [...(list ?? []), taskFromInput(tempId, data)]),
    });
  },
  update: (id: string, data: Partial<TaskInput>) =>
    writeOrQueue<{ task: Task }>({
      entity: "tasks",
      method: "PATCH",
      path: `/tasks/${id}`,
      body: data,
      send: () => tasksApi.update(id, data),
      queuedResult: () => ({ task: patchTask(qc.getQueryData<Task[]>(["tasks"])?.find((t) => t.id === id) ?? ({ id } as Task), data) }),
      applyToCache: () => qc.setQueryData<Task[]>(["tasks"], (list) => list?.map((t) => (t.id === id ? patchTask(t, data) : t))),
    }),
  remove: (id: string) =>
    writeOrQueue<void>({
      entity: "tasks",
      method: "DELETE",
      path: `/tasks/${id}`,
      send: () => tasksApi.remove(id),
      queuedResult: () => undefined,
      applyToCache: () => qc.setQueryData<Task[]>(["tasks"], (list) => list?.filter((t) => t.id !== id)),
    }),
};

export const offlineShopping = {
  add: (label: string) => {
    const tempId = newTempId();
    return writeOrQueue<{ item: ShoppingItem }>({
      entity: "shopping",
      method: "POST",
      path: "/shopping",
      body: { label },
      tempId,
      send: () => shoppingApi.add(label),
      queuedResult: () => ({ item: shoppingItemFor(tempId, label) }),
      applyToCache: () => qc.setQueryData<ShoppingItem[]>(["shopping"], (list) => [...(list ?? []), shoppingItemFor(tempId, label)]),
    });
  },
  setChecked: (id: string, checked: boolean) =>
    writeOrQueue<{ item: ShoppingItem }>({
      entity: "shopping",
      method: "PATCH",
      path: `/shopping/${id}`,
      body: { checked },
      send: () => shoppingApi.update(id, { checked }),
      queuedResult: () => ({ item: { ...(qc.getQueryData<ShoppingItem[]>(["shopping"])?.find((i) => i.id === id) ?? shoppingItemFor(id, "")), checked } }),
      applyToCache: () => qc.setQueryData<ShoppingItem[]>(["shopping"], (list) => list?.map((i) => (i.id === id ? { ...i, checked } : i))),
    }),
  remove: (id: string) =>
    writeOrQueue<void>({
      entity: "shopping",
      method: "DELETE",
      path: `/shopping/${id}`,
      send: () => shoppingApi.remove(id),
      queuedResult: () => undefined,
      applyToCache: () => qc.setQueryData<ShoppingItem[]>(["shopping"], (list) => list?.filter((i) => i.id !== id)),
    }),
};

export const offlineMeals = {
  set: (data: MealInput) => {
    const tempId = newTempId();
    return writeOrQueue<{ meal: Meal }>({
      entity: "meals",
      method: "POST",
      path: "/meals",
      body: data,
      tempId,
      send: () => mealsApi.set(data),
      queuedResult: () => ({ meal: setMealIn([], tempId, data)[0] }),
      applyToCache: () => qc.setQueryData<Meal[]>(["meals"], (list) => setMealIn(list ?? [], tempId, data)),
    });
  },
  remove: (id: string) =>
    writeOrQueue<void>({
      entity: "meals",
      method: "DELETE",
      path: `/meals/${id}`,
      send: () => mealsApi.remove(id),
      queuedResult: () => undefined,
      applyToCache: () => qc.setQueryData<Meal[]>(["meals"], (list) => list?.filter((m) => m.id !== id)),
    }),
};

type ExpenseAnswer = { expense: Expense; alert: CapAlert | null; drift?: DriftAlert | null };

export const offlineExpenses = {
  create: (data: ExpenseInput) => {
    const tempId = newTempId();
    const expense = expenseFromInput(tempId, data);
    return writeOrQueue<ExpenseAnswer>({
      entity: "expenses",
      method: "POST",
      path: "/expenses",
      body: data,
      tempId,
      foldable: true,
      send: () => expensesApi.create(data),
      queuedResult: () => ({ expense, alert: null }),
      applyToCache: () => qc.setQueryData<MonthlyBudget>(["expenses", data.date.slice(0, 7)], (budget) => (budget ? addExpenseTo(budget, expense) : budget)),
    });
  },
  remove: (id: string) =>
    writeOrQueue<void>({
      entity: "expenses",
      method: "DELETE",
      path: `/expenses/${id}`,
      send: () => expensesApi.remove(id),
      queuedResult: () => undefined,
      applyToCache: () => qc.setQueriesData<MonthlyBudget>({ queryKey: ["expenses"] }, (budget) => (budget && "expenses" in budget ? removeExpenseFrom(budget, id) : budget)),
    }),
};
