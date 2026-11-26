import { View } from "react-native";
import { Pressable } from "./Touchable";
import { router } from "expo-router";
import { Card } from "./Card";
import { Text } from "./Text";
import { CalendarIcon, MealIcon, WalletIcon } from "./icons";
import { useMeals, useMonthlyBudget, useRecipes, useTaskDone, useTasks } from "../hooks/useApi";
import { weekKey } from "../lib/stars";
import { dayKey } from "../lib/appointments";
import { todayWeekday } from "../lib/weekdays";
import { currentMonth } from "../lib/money";
import { nowTime, todayLines, todaySummary } from "../lib/today";
import { color, space } from "../theme/tokens";

// « Aujourd'hui » at the top of Planning: one line per pillar — next task,
// tonight's dinner, money left this month. Each line opens its tab.
export function TodayCard() {
  const { data: tasks = [] } = useTasks();
  const { data: meals = [] } = useMeals();
  const { data: recipes = [] } = useRecipes();
  const { data: budget } = useMonthlyBudget(currentMonth());
  const { data: doneMarks } = useTaskDone(weekKey());
  const today = dayKey(new Date());
  const doneIds = doneMarks ? new Set(doneMarks.filter((m) => m.day === today).map((m) => m.taskId)) : undefined;
  const s = todaySummary(todayWeekday(), nowTime(), tasks, meals, recipes, budget, today, doneIds);

  const lines = todayLines(s);

  return (
    <Card style={{ gap: space.md, paddingVertical: space.lg }}>
      <Text weight="medium" size={13} tone="muted">
        Aujourd'hui
      </Text>
      <Line icon={<CalendarIcon size={15} color={color.pillar1} />} text={lines.tasks} />
      <Line icon={<MealIcon size={15} color={color.pillar2} />} text={lines.dinner} onPress={() => router.push("/repas")} />
      <Line icon={<WalletIcon size={15} color={color.pillar3} />} text={lines.budget} danger={lines.overBudget} onPress={() => router.push("/budget?tab=budget")} />
    </Card>
  );
}

function Line({ icon, text, onPress, danger }: { icon: React.ReactNode; text: string; onPress?: () => void; danger?: boolean }) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      {icon}
      <Text size={13} tone={danger ? "danger" : "text"} style={{ flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}
