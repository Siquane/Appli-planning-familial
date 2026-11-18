export type FamilyRole = "owner" | "full" | "planning";

export interface User {
  id: string;
  email: string;
  name: string;
  initials: string;
  /** The family's id (the owner's): what the store identifies the subscription with. Absent in sessions saved by older versions. */
  familyId?: string;
  familyRole?: FamilyRole;
  /** One-time message after the family changed hands; closed with familyApi.dismissNotice. */
  familyNotice?: FamilyNotice | null;
}

export type FamilyNotice =
  | { kind: "heir"; from: string }
  | { kind: "newOwner"; from: string; heir: string }
  | { kind: "detached"; from: string };

export interface FamilyAccount {
  id: string;
  name: string;
  initials: string;
  role: FamilyRole;
  isMe: boolean;
}

export interface FamilyInvite {
  code: string;
  role: "full" | "planning";
  expiresAt: string;
  expired: boolean;
}

export interface FamilyInfo {
  role: FamilyRole;
  maxAccounts: number;
  accounts: FamilyAccount[];
  /** The owner only. */
  invite: FamilyInvite | null;
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
  // Food preferences (menus générés).
  favoriteFoods: string;
  dislikedFoods: string;
  appetite: Appetite | null;
  /** 0 = lundi … 4 = vendredi : déjeuner à la cantine. */
  canteenDays: number[];
  foodNotes: string;
  // Sensitive: only accepted by the server after the account's consent.
  diets: MemberDiet[];
  allergies: string;
  foodsToLimit: string;
}

export type Appetite = "petit" | "moyen" | "gros";
export type MemberDiet = "végétarien" | "vegan" | "sans-porc" | "halal" | "casher" | "sans-gluten" | "sans-lactose";

export type MemberInput = Partial<{
  name: string;
  initials: string;
  tint: Tint;
  age: number | null;
  birthday: string | null;
  favoriteFoods: string;
  dislikedFoods: string;
  appetite: Appetite | null;
  canteenDays: number[];
  foodNotes: string;
  diets: MemberDiet[];
  allergies: string;
  foodsToLimit: string;
}>;

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
  /** Tâches créées ensemble sur plusieurs jours : même seriesId. */
  seriesId: string | null;
  /** Étoiles gagnées par un enfant assigné quand la tâche est faite (1 à 5). */
  stars: number;
  /** Apparaît dans le récap du soir et du matin (vrai par défaut). */
  inDigest: boolean;
  /** Rendez-vous : date précise « AAAA-MM-JJ » (null = tâche de la semaine type). */
  appointmentDate: string | null;
  location: string;
  /** Rappel d'un rendez-vous : 1 h avant ou la veille à 20 h. */
  remind: "hour" | "eve" | null;
}

/** Une tâche cochée « faite » un jour donné (« AAAA-MM-JJ »). */
export interface TaskDoneMark {
  taskId: string;
  day: string;
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
  /** Horaires de travail du compte connecté (0 = lundi … 6 = dimanche). */
  work: WorkHours;
}

export interface WorkHours {
  days: number[];
  start: string;
  end: string;
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
  /** Shopping list of a generated dish; empty for a family recipe (it has its own). */
  ingredients: string[];
}

export type MealInput = {
  weekday: Weekday;
  type: MealType;
  title?: string;
  recipeId?: string | null;
  notes?: string;
  ingredients?: string[];
};

export type MealDiet = "végétarien" | "vegan" | "sans-porc" | "halal" | "sans-gluten" | "sans-lactose";
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
  ingredients: string[];
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
  /** Paid date, or the end of the trial while it runs. */
  until: string | null;
  /** Budget+ only: the free trial. */
  trial?: { available: boolean; active: boolean; days: number; endsAt: string | null };
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

// Bank statement import (Budget+): what the server read from the PDF.
export interface StatementRow {
  id: number;
  date: string;
  label: string;
  detail: string;
  kind: string;
  amountCents: number;
  /** Suggested category. */
  category: string;
  source: "learned" | "rule" | "default";
  /** Already in the budget (same amount, within 3 days). */
  duplicate: boolean;
  /** Looks like a monthly expense (direct debit, rent…). */
  recurringHint: boolean;
}

export interface StatementParse {
  rows: StatementRow[];
  ignoredCredits: { count: number; totalCents: number };
  /** `ok` null when the statement prints no total. */
  check: { readDebitsCents: number; expectedDebitsCents: number | null; ok: boolean | null };
}

export interface StatementImportRow {
  date: string;
  label: string;
  amountCents: number;
  category: string;
  recurring: boolean;
  learn: boolean;
}

export interface StarChild {
  memberId: string;
  balance: number;
  weekStars: number;
}

export interface Reward {
  id: string;
  title: string;
  cost: number;
}

export interface StarsState {
  children: StarChild[];
  /** Tâches faites cette semaine. */
  completions: { taskId: string; memberId: string; stars: number }[];
  rewards: Reward[];
  history: { id: string; kind: "earned" | "spent"; memberId: string; title: string; stars: number; createdAt: string }[];
}

/** Budget+ : catégorie nettement plus chère que la moyenne des 3 mois précédents. */
export interface Drift {
  category: string;
  totalCents: number;
  averageCents: number;
  increaseCents: number;
  increasePct: number;
}

export interface DriftAlert extends Drift {
  categoryName: string;
}

export interface Debit {
  day: number;
  label: string;
  amountCents: number;
  category: string;
  passed: boolean;
}

export interface DebitCalendar {
  month: string;
  debits: Debit[];
  passedCents: number;
  upcomingCents: number;
}

export type NoteColor = "default" | "cyan" | "blue" | "lavender" | "violet" | "green" | "amber";

/** « Famille » (shared) : vue par tous les comptes ; « Perso » : par son auteur seulement. */
export interface Note {
  id: string;
  title: string;
  body: string;
  shared: boolean;
  color: NoteColor;
  pinned: boolean;
  /** Écrite par ce compte. */
  mine: boolean;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteInput = Pick<Note, "title" | "body" | "shared" | "color" | "pinned">;
