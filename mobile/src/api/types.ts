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

export type MealDiet = "végétarien" | "pescetarien" | "sans-porc" | "halal" | "sans-gluten" | "sans-lactose";
export type CookTime = "express" | "normal" | "élaboré";
export type RecipeUsage = "souvent" | "parfois" | "jamais";

/** Answers to the "Générer mes menus" questionnaire. */
export interface MealPlanPreferences {
  diets: MealDiet[];
  allergies: string;
  weekdayTime: CookTime;
  weekendTime: CookTime;
  fishPerWeek: number | null;
  veggiePerWeek: number | null;
  useMyRecipes: RecipeUsage;
  wishes: string;
  avoid: string;
}

export interface MealSlot {
  weekday: Weekday;
  type: MealType;
}

/** A suggested meal, not saved yet. */
export interface ProposedMeal extends MealSlot {
  title: string;
  recipeId: string | null;
  notes: string;
}

export interface MealQuota {
  period: "trial" | "free" | "premium";
  weeksUsed: number;
  weeksLimit: number;
  rerollsUsed: number;
  rerollsLimit: number;
  resetsAt: string;
}

export interface PackStatus {
  active: boolean;
  until: string | null;
}

export interface Plan {
  packs: { budget: PackStatus; meals: PackStatus };
  meals: MealQuota;
  /** limit null = unlimited (Premium). */
  documents: { used: number; limit: number | null };
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null; // "YYYY-MM-DD"
}

export interface CapAlert {
  category: ExpenseCategory;
  categoryName: string;
  level: 80 | 100;
  totalCents: number;
  limitCents: number;
}

export interface Forecast {
  month: string;
  spentCents: number;
  upcomingRecurringCents: number;
  projectedCents: number;
  /** Average total of the previous months, null without history. */
  usualCents: number | null;
}

export interface ReportMonth {
  month: string; // "YYYY-MM"
  totalCents: number;
  byCategory: { category: ExpenseCategory; totalCents: number }[];
}

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

export type FixedExpenseCategory =
  | "courses"
  | "logement"
  | "énergie"
  | "assurances"
  | "transport"
  | "santé"
  | "enfants"
  | "abonnements"
  | "restaurants"
  | "loisirs"
  | "shopping"
  | "vacances"
  | "impôts"
  | "épargne"
  | "animaux"
  | "cadeaux"
  | "divers";
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
  goalId: string | null;
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
