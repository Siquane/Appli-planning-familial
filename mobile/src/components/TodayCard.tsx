import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Card } from "./Card";
import { Text } from "./Text";
import { CalendarIcon, MealIcon, WalletIcon } from "./icons";
import { useMeals, useMonthlyBudget, useRecipes, useTasks } from "../hooks/useApi";
import { todayWeekday } from "../lib/weekdays";
import { currentMonth, formatEuros } from "../lib/money";
import { nowTime, todaySummary } from "../lib/today";
import { color, space } from "../theme/tokens";

// « Aujourd'hui » at the top of Planning: one line per pillar — next task,
// tonight's dinner, money left this month. Each line opens its tab.
export function TodayCard() {
  const { data: tasks = [] } = useTasks();
  const { data: meals = [] } = useMeals();
  const { data: recipes = [] } = useRecipes();
  const { data: budget } = useMonthlyBudget(currentMonth());
  const s = todaySummary(todayWeekday(), nowTime(), tasks, meals, recipes, budget);

  const taskLine =
    s.taskCount === 0
      ? "Rien de prévu aujourd'hui"
      : s.next
        ? `${s.taskCount} tâche${s.taskCount > 1 ? "s" : ""} · prochaine : ${s.next.time} ${s.next.title}`
        : `${s.taskCount} tâche${s.taskCount > 1 ? "s" : ""} · journée terminée`;
  const dinnerLine = s.dinner ? `Ce soir : ${s.dinner}` : "Dîner pas encore prévu";
  const left = s.budget.capCents !== null ? s.budget.capCents - s.budget.spentCents : null;
  const budgetLine =
    left === null ? `${formatEuros(s.budget.spentCents)} dépensés ce mois-ci` : left >= 0 ? `Reste ${formatEuros(left)} sur les plafonds du mois` : `Plafonds dépassés de ${formatEuros(-left)}`;

  return (
    <Card style={{ gap: space[3] }}>
      <Text weight="medium" size={13} tone="muted">
        Aujourd'hui
      </Text>
      <Line icon={<CalendarIcon size={15} color={color.pillar1} />} text={taskLine} />
      <Line icon={<MealIcon size={15} color={color.pillar2} />} text={dinnerLine} onPress={() => router.push("/repas")} />
      <Line icon={<WalletIcon size={15} color={color.pillar3} />} text={budgetLine} danger={left !== null && left < 0} onPress={() => router.push("/budget")} />
    </Card>
  );
}

function Line({ icon, text, onPress, danger }: { icon: React.ReactNode; text: string; onPress?: () => void; danger?: boolean }) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      {icon}
      <Text size={13.5} tone={danger ? "danger" : "text"} style={{ flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
