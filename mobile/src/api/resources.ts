import { api } from "./client";
import type {
  AutoSlotResult,
  CalendarStatus,
  Constraints,
  DocumentInput,
  DocumentUploadTicket,
  ExpenseInput,
  Expense,
  FamilyDocument,
  Meal,
  MealInput,
  Member,
  MonthlyBudget,
  Notification,
  Priority,
  Recipe,
  RecipeInput,
  ReplanProposal,
  SharedPerson,
  Task,
  TaskInput,
  Tint,
  Weekday,
} from "./types";

export const membersApi = {
  list: () => api.get<{ members: Member[] }>("/members"),
  create: (data: { name: string; initials?: string; tint?: Tint; age?: number | null; birthday?: string | null }) =>
    api.post<{ member: Member }>("/members", data),
  update: (id: string, data: Partial<{ name: string; initials: string; tint: Tint; age: number | null; birthday: string | null }>) =>
    api.patch<{ member: Member }>(`/members/${id}`, data),
  remove: (id: string) => api.delete<void>(`/members/${id}`),
};

export const tasksApi = {
  list: () => api.get<{ tasks: Task[] }>("/tasks"),
  create: (data: TaskInput) => api.post<{ task: Task }>("/tasks", data),
  update: (id: string, data: Partial<TaskInput>) => api.patch<{ task: Task }>(`/tasks/${id}`, data),
  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
  replanProposals: () => api.get<{ proposals: ReplanProposal[] }>("/tasks/replan/proposals"),
  autoSlot: (data: { priority: Priority; deadlineWeekday: Weekday | null; memberIds: string[] }) =>
    api.post<AutoSlotResult>("/tasks/auto-slot", data),
};

export const recipesApi = {
  list: () => api.get<{ recipes: Recipe[] }>("/recipes"),
  create: (data: RecipeInput) => api.post<{ recipe: Recipe }>("/recipes", data),
  update: (id: string, data: Partial<RecipeInput>) => api.patch<{ recipe: Recipe }>(`/recipes/${id}`, data),
  remove: (id: string) => api.delete<void>(`/recipes/${id}`),
};

export const mealsApi = {
  list: () => api.get<{ meals: Meal[] }>("/meals"),
  set: (data: MealInput) => api.post<{ meal: Meal }>("/meals", data),
  remove: (id: string) => api.delete<void>(`/meals/${id}`),
};

export const documentsApi = {
  /** Without recipeId: the family library. With it: that recipe's attachments. */
  list: (recipeId?: string) =>
    api.get<{ documents: FamilyDocument[] }>(recipeId ? `/documents?recipeId=${encodeURIComponent(recipeId)}` : "/documents"),
  create: (data: DocumentInput & { fileName: string; mimeType: string; size: number }) => api.post<DocumentUploadTicket>("/documents", data),
  confirm: (id: string) => api.post<{ document: FamilyDocument }>(`/documents/${id}/confirm`),
  update: (id: string, data: Partial<Pick<DocumentInput, "title" | "category" | "memberId">>) =>
    api.patch<{ document: FamilyDocument }>(`/documents/${id}`, data),
  remove: (id: string) => api.delete<void>(`/documents/${id}`),
};

export const expensesApi = {
  month: (month: string) => api.get<MonthlyBudget>(`/expenses?month=${month}`),
  create: (data: ExpenseInput) => api.post<{ expense: Expense }>("/expenses", data),
  update: (id: string, data: Partial<ExpenseInput>) => api.patch<{ expense: Expense }>(`/expenses/${id}`, data),
  remove: (id: string) => api.delete<void>(`/expenses/${id}`),
};

export const constraintsApi = {
  get: () => api.get<{ constraints: Constraints }>("/constraints"),
  update: (data: Partial<Pick<Constraints, "sleepStart" | "sleepEnd" | "lunchStart" | "lunchEnd" | "dndStart" | "dndEnd">>) =>
    api.patch<{ constraints: Constraints }>("/constraints", data),
};

export const notificationsApi = {
  list: () => api.get<{ notifications: Notification[] }>("/notifications"),
  markRead: (id: string) => api.post<void>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>("/notifications/read-all"),
};

export const shareApi = {
  get: () => api.get<{ shareToken: string; sharedWith: SharedPerson[] }>("/share"),
  invite: (data: { name: string; role?: string }) => api.post<{ person: SharedPerson }>("/share/people", data),
  remove: (id: string) => api.delete<void>(`/share/people/${id}`),
};

export const calendarApi = {
  status: () => api.get<CalendarStatus>("/calendar/status"),
  disconnect: (provider: string) => api.delete<void>(`/calendar/${provider}`),
  connectApple: () => api.post<{ connection: { provider: string } }>("/calendar/apple/connect"),
};
