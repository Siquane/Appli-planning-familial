export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
}

export type Tint = "accent" | "neutral" | "accent2";

export interface Member {
  id: string;
  userId: string;
  name: string;
  initials: string;
  tint: Tint;
  age: number | null;
  birthday: string | null;
  order: number;
}

export type Category = "École" | "Travail" | "Maison" | "Santé" | "Loisirs";
export type Priority = "high" | "medium" | "low";
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Task {
  id: string;
  title: string;
  category: Category;
  weekday: Weekday;
  date: string;
  time: string;
  duration: number;
  priority: Priority;
  deadlineWeekday: Weekday | null;
  recurring: boolean;
  reminder: boolean;
  flexible: boolean;
  synced: boolean;
  notes: string;
  memberIds: string[];
  externalProvider: string | null;
}

export type TaskInput = Partial<Omit<Task, "id" | "date" | "externalProvider">> & {
  title: string;
  category: Category;
  weekday: Weekday;
  time: string;
};

export interface Constraints {
  userId: string;
  sleepStart: string;
  sleepEnd: string;
  lunchStart: string;
  lunchEnd: string;
  dndStart: string;
  dndEnd: string;
}

export interface ReplanCandidate {
  weekday: Weekday;
  time: string;
  score: number;
  reason: string;
}

export interface AutoSlotResult {
  weekday: Weekday;
  time: string;
  reasons: string[];
}

export interface ReplanProposal {
  taskId: string;
  title: string;
  currentWeekday: Weekday;
  currentTime: string;
  candidates: ReplanCandidate[];
}

export interface Notification {
  id: string;
  title: string;
  unread: boolean;
  createdAt: string;
  group: "today" | "week";
}

export interface SharedPerson {
  id: string;
  userId: string;
  name: string;
  role: string;
}

export interface CalendarConnection {
  provider: "google" | "outlook" | "apple";
  email: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  memberIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type RecipeInput = {
  title: string;
  ingredients?: string[];
  steps?: string[];
  notes?: string;
  memberIds?: string[];
};

export type MealType = "petit-déjeuner" | "déjeuner" | "goûter" | "dîner";

export interface Meal {
  id: string;
  weekday: Weekday;
  type: MealType;
  title: string;
  recipeId: string | null;
  notes: string;
}

export type MealInput = {
  weekday: Weekday;
  type: MealType;
  title?: string;
  recipeId?: string | null;
  notes?: string;
};

export interface CalendarStatus {
  connections: CalendarConnection[];
  googleConfigured: boolean;
  microsoftConfigured: boolean;
}

export type DocumentCategory = "santé" | "assurance" | "école" | "administratif" | "maison" | "autre";

// Named FamilyDocument to avoid clashing with the DOM's global `Document`.
// recipeId null = family library entry, otherwise a recipe attachment.
// url is a signed link to the file, valid about one hour.
export interface FamilyDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  memberId: string | null;
  recipeId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentInput = {
  title?: string;
  category?: DocumentCategory;
  memberId?: string | null;
  recipeId?: string | null;
};

export interface DocumentUploadTicket {
  document: FamilyDocument;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

export type FixedExpenseCategory = "courses" | "logement" | "transport" | "santé" | "enfants" | "loisirs" | "factures" | "autre";
// A fixed key, or the id of one of the family's CustomExpenseCategory.
export type ExpenseCategory = string;

export interface CustomExpenseCategory {
  id: string;
  name: string;
}

// amountCents: integer cents (12,50 € = 1250). date: "YYYY-MM-DD".
// recurringId: set when this is a month's copy of a RecurringExpense.
export interface Expense {
  id: string;
  label: string;
  amountCents: number;
  category: ExpenseCategory;
  memberId: string | null;
  recurringId: string | null;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseInput = {
  label: string;
  amountCents: number;
  category: ExpenseCategory;
  memberId: string | null;
  date: string;
};

export interface MonthlyBudget {
  month: string; // "YYYY-MM"
  totalCents: number;
  // limitCents: the category's monthly cap, null if none.
  byCategory: { category: ExpenseCategory; totalCents: number; limitCents: number | null }[];
  expenses: Expense[];
}

export interface CategoryBudget {
  category: ExpenseCategory;
  limitCents: number;
}

export interface RecurringExpense {
  id: string;
  label: string;
  amountCents: number;
  category: ExpenseCategory;
  memberId: string | null;
  dayOfMonth: number;
  startMonth: string;
}

export type RecurringExpenseInput = Omit<RecurringExpense, "id" | "startMonth">;

export interface ShoppingItem {
  id: string;
  label: string;
  checked: boolean;
  /** Added by « Générer depuis le menu ». */
  fromMenu: boolean;
  createdAt: string;
}

/** Draft returned by POST /recipes/import — not saved yet. */
export interface ImportedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
  notes: string;
}
