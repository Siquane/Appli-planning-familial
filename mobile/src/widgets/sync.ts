import { useChildSpaceStore } from "../state/childSpaceStore";
import { useEffect } from "react";
import { useMeals, useMembers, useMonthlyBudget, useNotes, useRecipes, useShoppingList, useTasks } from "../hooks/useApi";
import { currentMonth } from "../lib/money";
import { buildSnapshot } from "./snapshot";
import { refreshWidgets } from "./refresh";

/** Keeps the widgets in step with the app's data while signed in. */
export function useWidgetSync() {
  const { data: tasks } = useTasks();
  const { data: meals } = useMeals();
  const { data: recipes } = useRecipes();
  const { data: budget } = useMonthlyBudget(currentMonth());
  const { data: shopping } = useShoppingList();
  const { data: members } = useMembers();
  const { data: notes } = useNotes();
  // « Espace de Jules » ouvert : le budget chargé est celui de l'enfant, pas pour les widgets.
  const inChildSpace = useChildSpaceStore((s) => !!s.memberId);

  useEffect(() => {
    if (!tasks || !meals || inChildSpace) return;
    const timer = setTimeout(() => refreshWidgets(buildSnapshot(tasks, meals, recipes ?? [], budget, shopping ?? [], members ?? [], new Date(), notes ?? [])), 500);
    return () => clearTimeout(timer);
  }, [tasks, meals, recipes, budget, shopping, members, notes, inChildSpace]);
}
