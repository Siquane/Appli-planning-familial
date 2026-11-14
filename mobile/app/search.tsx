import { useMemo, useState } from "react";
import { Pressable } from "../src/components/Touchable";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { BackHeader } from "../src/components/PageHeader";
import { Text } from "../src/components/Text";
import { TextField } from "../src/components/TextField";
import { Card } from "../src/components/Card";
import { TaskCard } from "../src/components/TaskCard";
import { BookIcon, DocumentIcon, MealIcon, SearchEmptyIcon, WalletIcon } from "../src/components/icons";
import { useDocuments, useMembers, useMonthlyBudget, useRecipes, useShoppingList, useTasks } from "../src/hooks/useApi";
import { searchAll } from "../src/lib/search";
import { currentMonth, formatEuros, shortDay } from "../src/lib/money";
import { color, space } from "../src/theme/tokens";

// One search box for the whole app: tasks, recipes (and their ingredients),
// documents, this month's expenses and the shopping list.
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();
  const { data: recipes = [] } = useRecipes();
  const { data: documents = [] } = useDocuments();
  const { data: budget } = useMonthlyBudget(currentMonth());
  const { data: shopping = [] } = useShoppingList();

  const results = useMemo(
    () => searchAll(query, { tasks, recipes, documents, expenses: budget?.expenses ?? [], shopping }),
    [query, tasks, recipes, documents, budget, shopping],
  );
  const hasQuery = query.trim().length > 0;

  return (
    <Screen keyboard>
      <BackHeader title="Recherche" />
      <TextField value={query} onChangeText={setQuery} placeholder="Tâche, recette, ingrédient, document…" autoCapitalize="none" autoFocus />

      {hasQuery && results.total === 0 && (
        <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
          <SearchEmptyIcon size={26} color={color.neutral600} />
          <Text tone="muted" size={13} center>
            Rien ne correspond à « {query.trim()} ».
          </Text>
        </Card>
      )}

      {!hasQuery && (
        <Text tone="faint" size={13} center>
          Cherche dans le planning, les recettes et leurs ingrédients, les documents, les dépenses du mois et la liste de courses.
        </Text>
      )}

      {results.tasks.length > 0 && (
        <Section title="Planning" count={results.tasks.length}>
          {results.tasks.map((task) => (
            <TaskCard key={task.id} task={task} members={members} />
          ))}
        </Section>
      )}

      {results.recipes.length > 0 && (
        <Section title="Recettes" count={results.recipes.length}>
          {results.recipes.map((r) => (
            <Row key={r.id} icon={<BookIcon size={14} color={color.pillar2} />} title={r.title} onPress={() => router.push(`/recipe/${r.id}`)} />
          ))}
        </Section>
      )}

      {results.shopping.length > 0 && (
        <Section title="Liste de courses" count={results.shopping.length}>
          {results.shopping.map((i) => (
            <Row key={i.id} icon={<MealIcon size={14} color={color.pillar2} />} title={i.label} subtitle={i.checked ? "Dans le panier" : "À acheter"} onPress={() => router.push("/repas")} />
          ))}
        </Section>
      )}

      {results.expenses.length > 0 && (
        <Section title="Dépenses du mois" count={results.expenses.length}>
          {results.expenses.map((e) => (
            <Row
              key={e.id}
              icon={<WalletIcon size={14} color={color.pillar3} />}
              title={e.label}
              subtitle={`${formatEuros(e.amountCents)} · ${shortDay(e.date)}`}
              onPress={() => router.push(`/expense/new?edit=${e.id}&month=${currentMonth()}`)}
            />
          ))}
        </Section>
      )}

      {results.documents.length > 0 && (
        <Section title="Documents" count={results.documents.length}>
          {results.documents.map((d) => (
            <Row key={d.id} icon={<DocumentIcon size={14} color={color.pillar4} />} title={d.title} onPress={() => router.push(`/document/${d.id}`)} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text weight="medium" size={13} tone="muted">
        {title} ({count})
      </Text>
      {children}
    </View>
  );
}

function Row({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card row style={{ alignItems: "center" }}>
        {icon}
        <View style={{ flex: 1, marginLeft: space[2] }}>
          <Text size={15} weight="medium" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text size={11} tone="faint">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
