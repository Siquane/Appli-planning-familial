import { weekKey } from "../lib/stars";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { planApi, familyApi, statementsApi, savingsGoalsApi, shoppingApi, calendarApi, categoryBudgetsApi, constraintsApi, documentsApi, expenseCategoriesApi, expensesApi, recurringExpensesApi, mealsApi, membersApi, notificationsApi, recipesApi, shareApi, starsApi, tasksApi, notesApi, pocketMoneyApi, splitsApi } from "../api/resources";
import type { NoteInput, MemberInput, ShoppingItem, DocumentInput, ExpenseInput, RecurringExpenseInput, MealInput, StatementImportRow, Priority, RecipeInput, TaskDoneMark, TaskInput, Tint, Weekday } from "../api/types";
import { useChildSpaceStore } from "../state/childSpaceStore";
import { useAuthStore, useIsChildAccount } from "../state/authStore";
import { uploadPickedFile, type PickedFile } from "../lib/documentUpload";
import { buildCategoryOptions } from "../lib/money";
import { offlineExpenses, offlineMeals, offlineShopping, offlineTasks } from "../lib/offlineApi";

// Planning data is shared with the other accounts of the family: look for their changes every minute while the app is open.
const SHARED_REFRESH_MS = 60_000;
// Ce qui change moins souvent pendant qu'on regarde : toutes les 5 minutes
// (moins de batterie, de données mobiles et de quota gratuit pour la base).
const SLOW_REFRESH_MS = 5 * 60_000;
// Les recettes changent rarement et la liste peut être longue : moins souvent.
const RECIPES_REFRESH_MS = 5 * 60_000;

function useEnabled() {
  return !!useAuthStore((s) => s.accessToken);
}

export function useMembers() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["members"], queryFn: () => membersApi.list().then((r) => r.members), enabled, refetchInterval: SLOW_REFRESH_MS });
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
  const isChild = useIsChildAccount();
  return useQuery({ queryKey: ["food-consent"], queryFn: () => membersApi.foodConsent().then((r) => r.consentedAt), enabled: enabled && !isChild });
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
  return useQuery({ queryKey: ["recipes"], queryFn: () => recipesApi.list().then((r) => r.recipes), enabled, refetchInterval: RECIPES_REFRESH_MS });
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

/** Le menu d'une semaine (son lundi) ; par défaut la semaine en cours. */
export function useMeals(week: string = weekKey()) {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["meals", week], queryFn: () => mealsApi.list(week).then((r) => r.meals), enabled, refetchInterval: SLOW_REFRESH_MS });
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
    mutationFn: ({ week, meals }: { week: string; meals: MealInput[] }) => mealsApi.saveMany(week, meals),
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
  return useMutation({ mutationFn: (week: string) => shoppingApi.fromMenu(week), onSuccess: (r) => qc.setQueryData(["shopping"], r.items) });
}

export function useClearCheckedShopping() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => shoppingApi.clearChecked(), onSuccess: (r) => qc.setQueryData(["shopping"], r.items) });
}

export function useTasks() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["tasks"], queryFn: () => tasksApi.list().then((r) => r.tasks), enabled, refetchInterval: SHARED_REFRESH_MS });
}

// Tâches cochées « faites » pour une semaine (lundi « AAAA-MM-JJ »).
export function useTaskDone(week: string) {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["taskDone", week], queryFn: () => tasksApi.done(week).then((r) => r.done), enabled, refetchInterval: SHARED_REFRESH_MS });
}

// Coche / décoche tout de suite à l'écran, puis confirme auprès du serveur
// (et revient en arrière si l'envoi échoue).
export function useToggleTaskDone(week: string) {
  const qc = useQueryClient();
  const key = ["taskDone", week];
  return useMutation({
    mutationFn: (d: { taskId: string; day: string; done: boolean }) => (d.done ? tasksApi.markDone(d.taskId, d.day) : tasksApi.unmarkDone(d.taskId, d.day)),
    onMutate: async (d) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<TaskDoneMark[]>(key);
      const rest = (previous ?? []).filter((m) => !(m.taskId === d.taskId && m.day === d.day));
      qc.setQueryData<TaskDoneMark[]>(key, d.done ? [...rest, { taskId: d.taskId, day: d.day }] : rest);
      return { previous };
    },
    onError: (_e, _d, ctx) => qc.setQueryData(key, ctx?.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["constraints"] });
      qc.invalidateQueries({ queryKey: ["replan"] });
    },
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

export function useChildAccesses() {
  const enabled = useEnabled();
  const role = useAuthStore((st) => st.user?.familyRole);
  return useQuery({ queryKey: ["family", "children"], queryFn: () => familyApi.children().then((r) => r.children), enabled: enabled && role !== "child" });
}

export function useChildCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => familyApi.childCode(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useRemoveChildAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => familyApi.removeChild(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["family"] }),
  });
}

export function useMemberShareLinks() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["share", "members"], queryFn: () => shareApi.memberLinks().then((r) => r.links), enabled });
}

export function useResetMemberShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) => shareApi.resetMemberLink(memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["share", "members"] }),
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
  const isChild = useIsChildAccount();
  return useQuery({ queryKey: ["calendar-status"], queryFn: () => calendarApi.status(), enabled: enabled && !isChild });
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
export const useRequestReward = () => useStarsMutation((rewardId: string) => starsApi.requestReward(rewardId));
export const useAcceptRewardRequest = () => useStarsMutation((id: string) => starsApi.acceptRequest(id));
export const useDeclineRewardRequest = () => useStarsMutation((d: { id: string; note: string }) => starsApi.declineRequest(d.id, d.note));

// Notes (Famille + Perso), partagées entre les comptes : rafraîchies comme les autres listes partagées.
export function useNotes() {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["notes"], queryFn: () => notesApi.list().then((r) => r.notes), enabled, refetchInterval: SLOW_REFRESH_MS });
}

function useNotesMutation<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries({ queryKey: ["notes"] }) });
}

export const useCreateNote = () => useNotesMutation((data: NoteInput) => notesApi.create(data).then((r) => r.note));
export const useUpdateNote = () => useNotesMutation(({ id, data }: { id: string; data: Partial<NoteInput> }) => notesApi.update(id, data).then((r) => r.note));
export const useDeleteNote = () => useNotesMutation((id: string) => notesApi.remove(id));

// Argent de poche : pour un compte enfant, ou pour un parent dans « Espace de Jules ».
export function usePocketMoney() {
  const enabled = useEnabled();
  const isChild = useIsChildAccount();
  const inChildSpace = useChildSpaceStore((st) => !!st.memberId);
  return useQuery({ queryKey: ["pocket-money"], queryFn: () => pocketMoneyApi.get(), enabled: enabled && (isChild || inChildSpace) });
}

function usePocketMoneyMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pocket-money"] });
      void qc.invalidateQueries({ queryKey: ["advances"] });
    },
  });
}

/** Onglet Comptes : les avances de chaque enfant (adultes seulement). */
export function useFamilyAdvances() {
  const enabled = useEnabled();
  const isChild = useIsChildAccount();
  return useQuery({ queryKey: ["advances"], queryFn: () => pocketMoneyApi.familyAdvances().then((r) => r.children), enabled: enabled && !isChild });
}

export const useAddAdvance = () => usePocketMoneyMutation((d: { amountCents: number; label: string }) => pocketMoneyApi.addAdvance(d));
export const useRemoveAdvance = () => usePocketMoneyMutation((id: string) => pocketMoneyApi.removeAdvance(id));
export const useRepayAdvance = () => usePocketMoneyMutation((d: { id: string; amountCents?: number }) => pocketMoneyApi.repay(d.id, d.amountCents));
export const useAddFamilyAdvance = () => usePocketMoneyMutation((d: { memberId: string; amountCents: number; label: string }) => pocketMoneyApi.addFamilyAdvance(d));

export const useSetPocketMoneyRule = () => usePocketMoneyMutation((d: { amountCents: number; frequency: "weekly" | "monthly"; day: number }) => pocketMoneyApi.setRule(d));
export const useRemovePocketMoneyRule = () => usePocketMoneyMutation(() => pocketMoneyApi.removeRule());
export const useAddPocketMoneyCredit = () => usePocketMoneyMutation((d: { amountCents: number; label: string }) => pocketMoneyApi.addCredit(d));
export const useRemovePocketMoneyCredit = () => usePocketMoneyMutation((id: string) => pocketMoneyApi.removeCredit(id));

// ── Comptes partagés ──

export function useSplitGroups() {
  const enabled = useEnabled();
  // Les comptes partagés sont ceux des adultes (un compte enfant n'y a pas accès).
  const isChild = useIsChildAccount();
  return useQuery({ queryKey: ["splits"], queryFn: () => splitsApi.list().then((r) => r.groups), enabled: enabled && !isChild, refetchInterval: SLOW_REFRESH_MS });
}

export function useSplitGroup(id: string | undefined) {
  const enabled = useEnabled();
  return useQuery({ queryKey: ["splits", id], queryFn: () => splitsApi.get(id!).then((r) => r.group), enabled: enabled && !!id, refetchInterval: SHARED_REFRESH_MS });
}

/** Une action sur un groupe : met à jour son détail tout de suite et rafraîchit la liste. */
export function useSplitMutation<T, R extends { group?: import("../api/types").SplitGroup }>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (r?.group) qc.setQueryData(["splits", r.group.id], r.group);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["splits"] }),
  });
}
