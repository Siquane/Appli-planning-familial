import { errorText } from "../src/lib/errors";
import { useState } from "react";
import { Pressable, hitSlopFor } from "../src/components/Touchable";
import { Alert, TextInput, View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Screen } from "../src/components/Screen";
import { Text, scaled } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { ChevronRightIcon, PlusIcon, TrashIcon } from "../src/components/icons";
import {
  useCategoryBudgets,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useRecurringExpenses,
  useRenameExpenseCategory,
  useSetCategoryBudget,
} from "../src/hooks/useApi";
import { categoryLabel, centsToInput, formatEuros, parseAmount } from "../src/lib/money";
import { useToastStore } from "../src/state/toastStore";
import { color, font, radius, space, gutter } from "../src/theme/tokens";

const toast = (m: string) => useToastStore.getState().show(m);
const errorMessage = (e: unknown) => (errorText(e, "enregistrer le réglage"));

const inputStyle = {
  get color() { return color.text; },
  fontFamily: font.body,
  fontSize: scaled(15),
  paddingVertical: space.sm,
  paddingHorizontal: space.md,
  borderRadius: radius.md,
  get backgroundColor() { return color.bg; },
  borderWidth: 1,
  get borderColor() { return color.divider; },
} as const;

export default function BudgetSettingsScreen() {
  const { options, custom } = useExpenseCategories();
  const { data: budgets = [] } = useCategoryBudgets();
  const { data: recurring = [] } = useRecurringExpenses();

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Réglages du budget" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Section title="Dépenses récurrentes" hint="Loyer, abonnements… ajoutés chaque mois au jour choisi.">
          {recurring.map((r) => (
            <Pressable key={r.id} onPress={() => router.push(`/expense/recurring?edit=${r.id}`)}>
              <Card row style={{ alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="medium" numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Text size={12} tone="faint">
                    Le {r.dayOfMonth} du mois · {categoryLabel(options, r.category)}
                  </Text>
                </View>
                <Text size={15} weight="medium" style={{ marginRight: space.sm }}>
                  {formatEuros(r.amountCents)}
                </Text>
                <ChevronRightIcon size={14} color={color.neutral500} />
              </Card>
            </Pressable>
          ))}
          <Button label="Ajouter une dépense récurrente" icon={<PlusIcon size={18} color={color.text} />} variant="secondary" block onPress={() => router.push("/expense/recurring")} />
        </Section>

        <Section title="Plafonds mensuels" hint="Valables tous les mois. Laisse vide si tu n'en veux pas.">
          <Card style={{ gap: space.sm }}>
            {options.map((o) => {
              const limit = budgets.find((b) => b.category === o.value)?.limitCents ?? null;
              // Keyed on the saved value so the field resets when the server answers.
              return <CapRow key={`${o.value}:${limit}`} category={o.value} label={o.label} limitCents={limit} />;
            })}
          </Card>
        </Section>

        <Section title="Mes catégories" hint="En plus des catégories de base. En supprimer une range ses dépenses dans « Divers ».">
          {custom.length > 0 && (
            <Card style={{ gap: space.sm }}>
              {custom.map((c) => (
                <CustomCategoryRow key={`${c.id}:${c.name}`} id={c.id} name={c.name} />
              ))}
            </Card>
          )}
          <AddCategory />
        </Section>
      </KeyboardScrollView>
    </Screen>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text weight="medium" size={13} tone="muted">
        {title}
      </Text>
      <Text size={12} tone="faint">
        {hint}
      </Text>
      {children}
    </View>
  );
}

function CapRow({ category, label, limitCents }: { category: string; label: string; limitCents: number | null }) {
  const setBudget = useSetCategoryBudget();
  const initial = limitCents === null ? "" : centsToInput(limitCents);
  const [text, setText] = useState(initial);

  function save() {
    if (text.trim() === initial) return;
    const value = text.trim() === "" ? null : parseAmount(text);
    if (text.trim() !== "" && value === null) {
      toast("Montant invalide (ex. 600 ou 600,50).");
      setText(initial);
      return;
    }
    setBudget.mutate(
      { category, limitCents: value },
      {
        onSuccess: () => toast(value === null ? `Plafond « ${label} » retiré.` : `Plafond « ${label} » : ${formatEuros(value)}.`),
        onError: (e) => {
          toast(errorMessage(e));
          setText(initial);
        },
      },
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Text size={15} style={{ flex: 1 }}>
        {label}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        onEndEditing={save}
        placeholder="Aucun"
        placeholderTextColor={color.neutral600}
        keyboardType="decimal-pad"
        style={[inputStyle, { width: 110, textAlign: "right" }]}
        accessibilityLabel={`Plafond ${label}`}
      />
      <Text size={13} tone="muted">
        €
      </Text>
    </View>
  );
}

function CustomCategoryRow({ id, name }: { id: string; name: string }) {
  const rename = useRenameExpenseCategory();
  const remove = useDeleteExpenseCategory();
  const [text, setText] = useState(name);

  function save() {
    const next = text.trim();
    if (!next || next === name) return setText(name);
    rename.mutate({ id, name: next }, { onError: (e) => (toast(errorMessage(e)), setText(name)) });
  }

  function onDelete() {
    Alert.alert("Supprimer la catégorie", `Supprimer « ${name} » ? Ses dépenses passeront dans « Divers » et son plafond sera retiré.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => remove.mutate(id, { onSuccess: () => toast("Catégorie supprimée."), onError: (e) => toast(errorMessage(e)) }) },
    ]);
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <TextInput value={text} onChangeText={setText} onEndEditing={save} style={[inputStyle, { flex: 1 }]} accessibilityLabel={`Renommer ${name}`} />
      <Pressable hitSlop={hitSlopFor(26)} onPress={onDelete} accessibilityLabel={`Supprimer ${name}`} style={{ padding: space.sm }}>
        <TrashIcon size={16} color={color.neutral400} />
      </Pressable>
    </View>
  );
}

function AddCategory() {
  const create = useCreateExpenseCategory();
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    create.mutate(name.trim(), {
      onSuccess: () => {
        toast("Catégorie ajoutée.");
        setName("");
      },
      onError: (e) => toast(errorMessage(e)),
    });
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <TextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={add}
        placeholder="Ex. Jardin, Bricolage…"
        placeholderTextColor={color.neutral600}
        style={[inputStyle, { flex: 1, paddingVertical: 9 }]}
      />
      <Button label="Ajouter" variant="secondary" onPress={add} disabled={!name.trim()} loading={create.isPending} />
    </View>
  );
}
