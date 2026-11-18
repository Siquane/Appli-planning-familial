import { api } from "./client";
import type {
  Note,
  NoteInput,
  TaskDoneMark,
  DebitCalendar,
  Drift,
  DriftAlert,
  Reward,
  StarsState,
  AutoSlotResult,
  CalendarStatus,
  CategoryBudget,
  Constraints,
  CustomExpenseCategory,
  DocumentInput,
  DocumentUploadTicket,
  ExpenseInput,
  Expense,
  FamilyDocument,
  Meal,
  MealInput,
  MealQuota,
  Plan,
  SavingsGoal,
  CapAlert,
  ReportMonth,
  Forecast,
  MealPlanPreferences,
  MealSlot,
  ProposedMeal,
  FamilyInfo,
  FamilyInvite,
  StatementImportRow,
  StatementParse,
  Member,
  MemberInput,
  MonthlyBudget,
  Notification,
  Priority,
  ImportedRecipe,
  Recipe,
  RecurringExpense,
  RecurringExpenseInput,
  RecipeInput,
  ReplanProposal,
  SharedPerson,
  ShoppingItem,
  Task,
  TaskInput,
  Tint,
  Weekday,
} from "./types";

export const membersApi = {
  list: () => api.get<{ members: Member[] }>("/members"),
  create: (data: { name: string; initials?: string; tint?: Tint; age?: number | null; birthday?: string | null }) =>
    api.post<{ member: Member }>("/members", data),
  update: (id: string, data: MemberInput) => api.patch<{ member: Member }>(`/members/${id}`, data),
  remove: (id: string) => api.delete<void>(`/members/${id}`),
  foodConsent: () => api.get<{ consentedAt: string | null }>("/members/food-consent"),
  giveFoodConsent: () => api.post<{ consentedAt: string }>("/members/food-consent", {}),
  withdrawFoodConsent: () => api.delete<void>("/members/food-consent"),
};

export const tasksApi = {
  list: () => api.get<{ tasks: Task[] }>("/tasks"),
  create: (data: TaskInput) => api.post<{ task: Task }>("/tasks", data),
  update: (id: string, data: Partial<TaskInput>) => api.patch<{ task: Task }>(`/tasks/${id}`, data),
  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
  /** Coches « fait » d'une semaine (lundi « AAAA-MM-JJ »). */
  done: (week: string) => api.get<{ done: TaskDoneMark[] }>(`/tasks/done?week=${week}`),
  markDone: (id: string, day: string) => api.put<void>(`/tasks/${id}/done`, { day }),
  unmarkDone: (id: string, day: string) => api.delete<void>(`/tasks/${id}/done?day=${day}`),
  replanProposals: () => api.get<{ proposals: ReplanProposal[] }>("/tasks/replan/proposals"),
  autoSlot: (data: { priority: Priority; deadlineWeekday: Weekday | null; memberIds: string[] }) =>
    api.post<AutoSlotResult>("/tasks/auto-slot", data),
};

export const recipesApi = {
  list: () => api.get<{ recipes: Recipe[] }>("/recipes"),
  create: (data: RecipeInput) => api.post<{ recipe: Recipe }>("/recipes", data),
  update: (id: string, data: Partial<RecipeInput>) => api.patch<{ recipe: Recipe }>(`/recipes/${id}`, data),
  remove: (id: string) => api.delete<void>(`/recipes/${id}`),
  importFromUrl: (url: string) => api.post<{ recipe: ImportedRecipe }>("/recipes/import", { url }),
};

export const shoppingApi = {
  list: () => api.get<{ items: ShoppingItem[] }>("/shopping"),
  add: (label: string) => api.post<{ item: ShoppingItem }>("/shopping", { label }),
  update: (id: string, data: Partial<Pick<ShoppingItem, "label" | "checked">>) => api.patch<{ item: ShoppingItem }>(`/shopping/${id}`, data),
  remove: (id: string) => api.delete<void>(`/shopping/${id}`),
  fromMenu: () => api.post<{ added: number; withoutIngredients: number; items: ShoppingItem[] }>("/shopping/from-menu"),
  clearChecked: () => api.delete<{ removed: number; items: ShoppingItem[] }>("/shopping/checked"),
};

export const mealsApi = {
  list: () => api.get<{ meals: Meal[] }>("/meals"),
  set: (data: MealInput) => api.post<{ meal: Meal }>("/meals", data),
  remove: (id: string) => api.delete<void>(`/meals/${id}`),
  /** Asks the server (Claude) for suggestions — nothing is saved. */
  generate: (data: { slots: MealSlot[]; preferences: MealPlanPreferences; exclude?: string[]; kind: "week" | "reroll" }) =>
    api.post<{ meals: ProposedMeal[]; quota: MealQuota }>("/meals/generate", data),
  saveMany: (meals: MealInput[]) => api.post<{ meals: Meal[] }>("/meals/bulk", { meals }),
};

export const familyApi = {
  get: () => api.get<FamilyInfo>("/family"),
  createInvite: (role: "full" | "planning") => api.post<{ invite: FamilyInvite }>("/family/invite", { role }),
  revokeInvite: () => api.delete<void>("/family/invite"),
  removeAccount: (id: string) => api.delete<void>(`/family/accounts/${id}`),
  leave: () => api.post<void>("/family/leave"),
  dismissNotice: () => api.delete<void>("/family/notice"),
};

export const planApi = {
  get: () => api.get<Plan>("/plan"),
  startBudgetTrial: () => api.post<Plan>("/plan/trial/budget"),
};

export const statementsApi = {
  parse: (pdf: Blob) => api.upload<StatementParse>("/statements/parse", pdf, "application/pdf"),
  import: (rows: StatementImportRow[]) => api.post<{ imported: number; recurringCreated: number; rulesLearned: number }>("/statements/import", { rows }),
};

export const savingsGoalsApi = {
  list: () => api.get<{ goals: SavingsGoal[] }>("/savings-goals"),
  create: (data: { name: string; targetCents: number; deadline: string | null }) => api.post<{ goal: SavingsGoal }>("/savings-goals", data),
  update: (id: string, data: Partial<{ name: string; targetCents: number; deadline: string | null }>) =>
    api.patch<{ goal: SavingsGoal }>(`/savings-goals/${id}`, data),
  remove: (id: string) => api.delete<void>(`/savings-goals/${id}`),
  pay: (id: string, amountCents: number) => api.post<{ goal: SavingsGoal; month: string }>(`/savings-goals/${id}/payments`, { amountCents }),
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
  create: (data: ExpenseInput) => api.post<{ expense: Expense; alert: CapAlert | null; drift?: DriftAlert | null }>("/expenses", data),
  update: (id: string, data: Partial<ExpenseInput>) => api.patch<{ expense: Expense; alert: CapAlert | null; drift?: DriftAlert | null }>(`/expenses/${id}`, data),
  forecast: () => api.get<Forecast>("/expenses/forecast"),
  drifts: (month: string) => api.get<{ month: string; drifts: Drift[] }>(`/expenses/drifts?month=${month}`),
  debits: (month: string) => api.get<DebitCalendar>(`/expenses/debits?month=${month}`),
  report: (months = 6) => api.get<{ months: ReportMonth[] }>(`/expenses/report?months=${months}`),
  remove: (id: string) => api.delete<void>(`/expenses/${id}`),
};

export const expenseCategoriesApi = {
  list: () => api.get<{ categories: CustomExpenseCategory[] }>("/expense-categories"),
  create: (name: string) => api.post<{ category: CustomExpenseCategory }>("/expense-categories", { name }),
  rename: (id: string, name: string) => api.patch<{ category: CustomExpenseCategory }>(`/expense-categories/${id}`, { name }),
  remove: (id: string) => api.delete<void>(`/expense-categories/${id}`),
};

export const categoryBudgetsApi = {
  list: () => api.get<{ budgets: CategoryBudget[] }>("/category-budgets"),
  /** limitCents null removes the cap. */
  set: (category: string, limitCents: number | null) => api.put<unknown>("/category-budgets", { category, limitCents }),
};

export const recurringExpensesApi = {
  list: () => api.get<{ recurring: RecurringExpense[] }>("/recurring-expenses"),
  create: (data: RecurringExpenseInput) => api.post<{ recurring: RecurringExpense }>("/recurring-expenses", data),
  update: (id: string, data: Partial<RecurringExpenseInput>) => api.patch<{ recurring: RecurringExpense }>(`/recurring-expenses/${id}`, data),
  remove: (id: string) => api.delete<void>(`/recurring-expenses/${id}`),
};

export const constraintsApi = {
  get: () => api.get<{ constraints: Constraints }>("/constraints"),
  update: (data: Partial<Pick<Constraints, "sleepStart" | "sleepEnd" | "lunchStart" | "lunchEnd" | "dndStart" | "dndEnd"> & { workDays: number[]; workStart: string; workEnd: string }>) =>
    api.patch<{ constraints: Constraints }>("/constraints", data),
};

export const notificationsApi = {
  list: () => api.get<{ notifications: Notification[] }>("/notifications"),
  markRead: (id: string) => api.post<void>(`/notifications/${id}/read`),
  markAllRead: () => api.post<void>("/notifications/read-all"),
  savePushToken: (token: string) => api.put<void>("/notifications/push-token", { token }),
  familyAlerts: () => api.get<{ enabled: boolean }>("/notifications/family-alerts"),
  setFamilyAlerts: (enabled: boolean) => api.put<{ enabled: boolean }>("/notifications/family-alerts", { enabled }),
};

export const starsApi = {
  get: (week: string) => api.get<StarsState>(`/stars?week=${week}`),
  complete: (data: { taskId: string; memberId: string; week: string }) => api.post<void>("/stars/complete", data),
  uncomplete: (data: { taskId: string; memberId: string; week: string }) => api.delete<void>("/stars/complete", data),
  addReward: (data: { title: string; cost: number }) => api.post<{ reward: Reward }>("/stars/rewards", data),
  removeReward: (id: string) => api.delete<void>(`/stars/rewards/${id}`),
  redeem: (id: string, memberId: string) => api.post<{ balance: number }>(`/stars/rewards/${id}/redeem`, { memberId }),
  removeHistory: (id: string) => api.delete<void>(`/stars/history/${id}`),
};

export const notesApi = {
  list: () => api.get<{ notes: Note[] }>("/notes"),
  create: (data: NoteInput) => api.post<{ note: Note }>("/notes", data),
  update: (id: string, data: Partial<NoteInput>) => api.patch<{ note: Note }>(`/notes/${id}`, data),
  remove: (id: string) => api.delete<void>(`/notes/${id}`),
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
