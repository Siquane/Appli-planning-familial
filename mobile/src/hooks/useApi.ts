import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { calendarApi, categoryBudgetsApi, constraintsApi, documentsApi, expenseCategoriesApi, expensesApi, recurringExpensesApi, mealsApi, membersApi, notificationsApi, recipesApi, shareApi, tasksApi } from "../api/resources";
import type { DocumentInput, ExpenseInput, RecurringExpenseInput, MealInput, Priority, RecipeInput, TaskInput, Tint, Weekday } from "../api/types";
import { useAuthStore } from "../state/authStore";
import { uploadPickedFile, type PickedFile } from "../lib/documentUpload";
import { buildCategoryOptions } from "../lib/money";

function useEnabled() {
  return !!useAuthStore((s) => s.accessToken);
}

export function useMembers() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["members"], queryFn: () => membersApi.list().then((r) => r.members), enabled });
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
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; initials: string; tint: Tint; age: number | null; birthday: string | null }> }) =>
      membersApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }),
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
  return useQuery({ queryKey: ["recipes"], queryFn: () => recipesApi.list().then((r) => r.recipes), enabled });
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
  return useQuery({ queryKey: ["meals"], queryFn: () => mealsApi.list().then((r) => r.meals), enabled });
}

export function useSetMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MealInput) => mealsApi.set(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mealsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals"] }),
  });
}

export function useGenerateMeals() {
  return useMutation({ mutationFn: mealsApi.generate });
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
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
    mutationFn: (data: ExpenseInput) => expensesApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInput> }) => expensesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
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

export function useTasks() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list().then((r) => r.tasks), enabled });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskInput) => tasksApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TaskInput> }) => tasksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
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
