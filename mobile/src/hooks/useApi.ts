import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planApi, familyApi, statementsApi, savingsGoalsApi, shoppingApi, calendarApi, categoryBudgetsApi, constraintsApi, documentsApi, expenseCategoriesApi, expensesApi, recurringExpensesApi, mealsApi, membersApi, notificationsApi, recipesApi, shareApi, starsApi, tasksApi } from "../api/resources";
import type { MemberInput, ShoppingItem, DocumentInput, ExpenseInput, RecurringExpenseInput, MealInput, StatementImportRow, Priority, RecipeInput, TaskInput, Tint, Weekday } from "../api/types";
import { useAuthStore } from "../state/authStore";
import { uploadPickedFile, type PickedFile } from "../lib/documentUpload";
import { buildCategoryOptions } from "../lib/money";
import { offlineExpenses, offlineMeals, offlineShopping, offlineTasks } from "../lib/offlineApi";

// Planning data is shared with the other accounts of the family: look for their changes every minute while the app is open.
const SHARED_REFRESH_MS = 60_000;

function useEnabled() {
  return !!useAuthStore((s) => s.accessToken);
}

export function useMembers() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["members"], queryFn: () => membersApi.list().then((r) => r.members), enabled, refetchInterval: SHARED_REFRESH_MS });
}

export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; initials?: string; tint?: Tint; age?: number | null; birthday?: string | null }) => membersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MemberInput }) => membersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

/** Account-wide consent to store diets, allergies and foods to limit (RGPD). */
export function useFoodConsent() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["food-consent"], queryFn: () => membersApi.foodConsent().then((r) => r.consentedAt), enabled });
}

export function useSetFoodConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (give: boolean) => (give ? membersApi.giveFoodConsent().then(() => undefined) : membersApi.withdrawFoodConsent()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food-consent"] });
      // Withdrawing erases the sensitive fields server-side.
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => membersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useRecipes() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["recipes"], queryFn: () => recipesApi.list().then((r) => r.recipes), enabled, refetchInterval: SHARED_REFRESH_MS });
}

export function useCreateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: RecipeInput) => recipesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useUpdateRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecipeInput> }) => recipesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes"] }),
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recipesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useMeals() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["meals"], queryFn: () => mealsApi.list().then((r) => r.meals), enabled, refetchInterval: SHARED_REFRESH_MS });
}

export function useSetMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MealInput) => offlineMeals.set(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offlineMeals.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useGenerateMeals() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: mealsApi.generate, onSettled: () => qc.invalidateQueries({ queryKey: ["plan"] }) });
}

export function usePlan() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["plan"], queryFn: () => planApi.get(), enabled });
}

export function useStartBudgetTrial() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => planApi.startBudgetTrial(), onSuccess: (plan) => qc.setQueryData(["plan"], plan) });
}

export function useSavingsGoals() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["savings-goals"], queryFn: () => savingsGoalsApi.list().then((r) => r.goals), enabled });
}

function useInvalidateGoals() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["savings-goals"] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };
}

export function useCreateSavingsGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({ mutationFn: savingsGoalsApi.create, onSuccess: invalidate });
}

export function useDeleteSavingsGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({ mutationFn: (id: string) => savingsGoalsApi.remove(id), onSuccess: invalidate });
}

export function usePaySavingsGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({ mutationFn: ({ id, amountCents }: { id: string; amountCents: number }) => savingsGoalsApi.pay(id, amountCents), onSuccess: invalidate });
}

export function useForecast(enabled = true) {
  const authed = useEnabled();
  return useQuery({ queryKey: ["expenses", "forecast"], queryFn: () => expensesApi.forecast(), enabled: authed && enabled });
}

export function useDrifts(month: string, enabled = true) {
  const authed = useEnabled();
  return useQuery({ queryKey: ["expenses", "drifts", month], queryFn: () => expensesApi.drifts(month).then((r) => r.drifts), enabled: authed && enabled });
}

export function useDebits(month: string, enabled = true) {
  const authed = useEnabled();
  return useQuery({ queryKey: ["expenses", "debits", month], queryFn: () => expensesApi.debits(month), enabled: authed && enabled });
}

export function useBudgetReport(months = 6, enabled = true) {
  const authed = useEnabled();
  return useQuery({ queryKey: ["expenses", "report", months], queryFn: () => expensesApi.report(months).then((r) => r.months), enabled: authed && enabled });
}

export function useSaveMeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meals: MealInput[]) => mealsApi.saveMany(meals),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

// Library and recipe attachments share the ["documents"] prefix so one
// invalidation refreshes both.
export function useDocuments(recipeId?: string) {
  const enabled = useEnabled();
  return useQuery({
    queryKey: ["documents", recipeId ?? "library"],
    queryFn: () => documentsApi.list(recipeId).then((r) => r.documents),
    enabled,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, data }: { file: PickedFile; data: DocumentInput }) => uploadPickedFile(file, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      qc.invalidateQueries({ queryKey: ["plan"] });
    },
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<DocumentInput, "title" | "category" | "memberId">> }) => documentsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useMonthlyBudget(month: string) {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["expenses", month], queryFn: () => expensesApi.month(month), enabled });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseInput) => offlineExpenses.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      if (res.alert) qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInput> }) => expensesApi.update(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      if (res.alert) qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offlineExpenses.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

/** Fixed + family categories, ready for chips and labels. */
export function useExpenseCategories() {
  const enabled = useEnabled();
  const query = useQuery({ queryKey: ["expense-categories"], queryFn: () => expenseCategoriesApi.list().then((r) => r.categories), enabled });
  const custom = query.data ?? [];
  return { ...query, custom, options: buildCategoryOptions(custom) };
}

// Categories, caps and recurring expenses all change what a month shows.
function useInvalidateBudget() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };
}

export function useCreateExpenseCategory() {
  const invalidate = useInvalidateBudget();
  return useMutation({ mutationFn: (name: string) => expenseCategoriesApi.create(name), onSuccess: () => invalidate("expense-categories") });
}

export function useRenameExpenseCategory() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => expenseCategoriesApi.rename(id, name),
    onSuccess: () => invalidate("expense-categories"),
  });
}

export function useDeleteExpenseCategory() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: (id: string) => expenseCategoriesApi.remove(id),
    onSuccess: () => invalidate("expense-categories", "category-budgets", "recurring-expenses"),
  });
}

export function useCategoryBudgets() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["category-budgets"], queryFn: () => categoryBudgetsApi.list().then((r) => r.budgets), enabled });
}

export function useSetCategoryBudget() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ category, limitCents }: { category: string; limitCents: number | null }) => categoryBudgetsApi.set(category, limitCents),
    onSuccess: () => invalidate("category-budgets"),
  });
}

export function useRecurringExpenses() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["recurring-expenses"], queryFn: () => recurringExpensesApi.list().then((r) => r.recurring), enabled });
}

export function useCreateRecurringExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({ mutationFn: (data: RecurringExpenseInput) => recurringExpensesApi.create(data), onSuccess: () => invalidate("recurring-expenses") });
}

export function useUpdateRecurringExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecurringExpenseInput> }) => recurringExpensesApi.update(id, data),
    onSuccess: () => invalidate("recurring-expenses"),
  });
}

export function useDeleteRecurringExpense() {
  const invalidate = useInvalidateBudget();
  return useMutation({ mutationFn: (id: string) => recurringExpensesApi.remove(id), onSuccess: () => invalidate("recurring-expenses") });
}

export function useShoppingList() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["shopping"], queryFn: () => shoppingApi.list().then((r) => r.items), enabled, refetchInterval: SHARED_REFRESH_MS });
}

export function useAddShoppingItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (label: string) => offlineShopping.add(label), onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }) });
}

// Ticking an item updates the list at once (no wait for the server), then
// reconciles — in a shop with weak signal the tap must feel instant.
export function useToggleShoppingItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) => offlineShopping.setChecked(id, checked),
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey: ["shopping"] });
      const previous = qc.getQueryData<ShoppingItem[]>(["shopping"]);
      qc.setQueryData<ShoppingItem[]>(["shopping"], (items) => items?.map((i) => (i.id === id ? { ...i, checked } : i)));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(["shopping"], ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });
}

export function useDeleteShoppingItem() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => offlineShopping.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }) });
}

export function useShoppingFromMenu() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => shoppingApi.fromMenu(), onSuccess: (r) => qc.setQueryData(["shopping"], r.items) });
}

export function useClearCheckedShopping() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => shoppingApi.clearChecked(), onSuccess: (r) => qc.setQueryData(["shopping"], r.items) });
}

export function useTasks() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list().then((r) => r.tasks), enabled, refetchInterval: SHARED_REFRESH_MS });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskInput) => offlineTasks.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskInput> }) => offlineTasks.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => offlineTasks.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useAutoSlotTask() {
  return useMutation({
    mutationFn: (data: { priority: Priority; deadlineWeekday: Weekday | null; memberIds: string[] }) => tasksApi.autoSlot(data),
  });
}

export function useReplanProposals(enabledExtra = true) {
  const enabled = useEnabled() && enabledExtra;
  return useQuery({ queryKey: ["replan"], queryFn: () => tasksApi.replanProposals().then((r) => r.proposals), enabled });
}

export function useConstraints() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["constraints"], queryFn: () => constraintsApi.get().then((r) => r.constraints), enabled });
}

export function useUpdateConstraints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: constraintsApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["constraints"] }),
  });
}

export function useNotifications() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list().then((r) => r.notifications), enabled });
}

export function useFamilyAlerts() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["family-alerts"], queryFn: () => notificationsApi.familyAlerts().then((r) => r.enabled), enabled });
}

export function useSetFamilyAlerts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => notificationsApi.setFamilyAlerts(on).then((r) => r.enabled),
    onMutate: (on) => qc.setQueryData(["family-alerts"], on),
    onSettled: () => qc.invalidateQueries({ queryKey: ["family-alerts"] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useShare() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["share"], queryFn: () => shareApi.get(), enabled });
}

export function useInvitePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role?: string }) => shareApi.invite(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share"] }),
  });
}

export function useRemoveSharedPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shareApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share"] }),
  });
}

export function useCalendarStatus() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["calendar-status"], queryFn: () => calendarApi.status(), enabled });
}

export function useDisconnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => calendarApi.disconnect(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-status"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Bank statement import: reading changes nothing; importing adds expenses (and maybe monthly ones).
export function useParseStatement() {
  return useMutation({ mutationFn: (pdf: Blob) => statementsApi.parse(pdf) });
}

export function useImportStatement() {
  const invalidate = useInvalidateBudget();
  return useMutation({ mutationFn: (rows: StatementImportRow[]) => statementsApi.import(rows), onSuccess: () => invalidate("recurring-expenses") });
}


// Family sharing: the accounts around the same data, and the code to add one.
export function useFamily() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["family"], queryFn: () => familyApi.get(), enabled });
}

export function useCreateFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (role: "full" | "planning") => familyApi.createInvite(role), onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }) });
}

export function useRevokeFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => familyApi.revokeInvite(), onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }) });
}

export function useRemoveFamilyAccount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => familyApi.removeAccount(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }) });
}

// Étoiles des enfants (semaine = lundi « AAAA-MM-JJ », voir lib/stars.ts).
export function useStars(week: string) {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["stars", week], queryFn: () => starsApi.get(week), enabled });
}

function useStarsMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ["stars"] }) });
}

export const useToggleStar = () =>
  useStarsMutation((d: { taskId: string; memberId: string; week: string; done: boolean }) => {
    const { done, ...data } = d;
    return done ? starsApi.complete(data) : starsApi.uncomplete(data);
  });
export const useAddReward = () => useStarsMutation((d: { title: string; cost: number }) => starsApi.addReward(d));
export const useRemoveReward = () => useStarsMutation((id: string) => starsApi.removeReward(id));
export const useRedeemReward = () => useStarsMutation((d: { rewardId: string; memberId: string }) => starsApi.redeem(d.rewardId, d.memberId));
export const useRemoveStarHistory = () => useStarsMutation((id: string) => starsApi.removeHistory(id));
