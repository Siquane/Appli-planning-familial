import { useEffect, useMemo, useState } from "react";
import { errorText } from "../../src/lib/errors";
import { Pressable } from "../../src/components/Touchable";
import { View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { ChipPicker } from "../../src/components/ChipPicker";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { CloseIcon, ReshuffleIcon } from "../../src/components/icons";
import { MoreLink } from "../../src/components/MoreLink";
import { useGenerateMeals, useMeals, usePlan, useSaveMeals } from "../../src/hooks/useApi";
import { mealQuotaLabel, showApiError } from "../../src/lib/premium";
import { useSlowHint } from "../../src/hooks/useSlowHint";
import { useToastStore } from "../../src/state/toastStore";
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from "../../src/lib/weekdays";
import { weekTitle } from "../../src/lib/appointments";
import { useMenuWeek } from "../../src/state/menuWeekStore";
import {
  COOK_TIME_OPTIONS,
  DEFAULT_PREFERENCES,
  DIET_OPTIONS,
  MEAL_TYPES,
  PER_WEEK_OPTIONS,
  RECIPE_USAGE_OPTIONS,
  buildSlots,
  countFilled,
  loadPreferences,
  savePreferences,
  type FillMode,
} from "../../src/lib/mealPlan";
import { color, space, gutter } from "../../src/theme/tokens";
import type { MealPlanPreferences, MealType, ProposedMeal, Weekday } from "../../src/api/types";

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const perWeekValue = (n: number | null) => (n === null ? "any" : String(Math.min(n, 3)));
const perWeekFromValue = (v: string | null) => (v === null || v === "any" ? null : Number(v));

// "Générer mes menus": a short questionnaire, then Claude's proposal that the
// user can tweak slot by slot before saving it into the week.
export default function MealPlanScreen() {
  // La semaine affichée dans Repas : la proposition est faite pour elle.
  const week = useMenuWeek();
  const { data: meals = [] } = useMeals(week);
  const generate = useGenerateMeals();
  const save = useSaveMeals();
  const { data: plan } = usePlan();
  const quota = plan?.meals;
  const weeksLeft = quota ? quota.weeksLimit - quota.weeksUsed : 1;
  const rerollsLeft = quota ? quota.rerollsLimit - quota.rerollsUsed : 1;

  const [days, setDays] = useState<Weekday[]>(ALL_DAYS);
  const [types, setTypes] = useState<MealType[]>(["déjeuner", "dîner"]);
  const [mode, setMode] = useState<FillMode>("empty");
  const [prefs, setPrefs] = useState<MealPlanPreferences>(DEFAULT_PREFERENCES);
  const [proposal, setProposal] = useState<ProposedMeal[] | null>(null);
  const [rerolling, setRerolling] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences().then(setPrefs);
  }, []);

  const filled = useMemo(() => countFilled(days, types, meals), [days, types, meals]);
  const slots = useMemo(() => buildSlots(days, types, meals, filled > 0 ? mode : "empty"), [days, types, meals, mode, filled]);
  const slow = useSlowHint(generate.isPending && !rerolling, 4_000);

  const update = <K extends keyof MealPlanPreferences>(key: K, value: MealPlanPreferences[K]) => setPrefs((p) => ({ ...p, [key]: value }));

  async function onGenerate() {
    if (slots.length === 0) {
      useToastStore.getState().show("Ces repas sont déjà tous prévus. Choisis « Tout remplacer » ou d'autres jours.");
      return;
    }
    savePreferences(prefs);
    try {
      const res = await generate.mutateAsync({ week, slots, preferences: prefs, kind: "week" });
      if (res.meals.length === 0) {
        useToastStore.getState().show("Claude n'a rien proposé cette fois. Réessaie dans un instant.");
        return;
      }
      setProposal(res.meals);
    } catch (e) {
      showApiError(e);
    }
  }

  async function onReroll(meal: ProposedMeal) {
    if (!proposal) return;
    const key = `${meal.weekday}|${meal.type}`;
    setRerolling(key);
    try {
      const res = await generate.mutateAsync({
        week,
        slots: [{ weekday: meal.weekday, type: meal.type }],
        preferences: prefs,
        exclude: proposal.map((m) => m.title),
        kind: "reroll",
      });
      const next = res.meals[0];
      if (next) setProposal((p) => p?.map((m) => (m.weekday === meal.weekday && m.type === meal.type ? next : m)) ?? p);
    } catch (e) {
      showApiError(e);
    } finally {
      setRerolling(null);
    }
  }

  function onRemove(meal: ProposedMeal) {
    setProposal((p) => p?.filter((m) => !(m.weekday === meal.weekday && m.type === meal.type)) ?? p);
  }

  async function onSave() {
    if (!proposal?.length) return;
    try {
      await save.mutateAsync({ week, meals: proposal.map(({ weekday, type, title, recipeId, notes, ingredients }) => ({ week, weekday, type, title, recipeId, notes, ingredients })) });
      useToastStore.getState().show(`${proposal.length} repas ajoutés au menu.`);
      router.back();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer les menus"));
    }
  }

  if (proposal) {
    const byDay = ALL_DAYS.map((d) => ({ day: d, items: proposal.filter((m) => m.weekday === d) })).filter((g) => g.items.length > 0);
    return (
      <Screen scroll={false} padded={false}>
        <TopBar title="Proposition de menus" onBack={() => setProposal(null)} />
        <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
          {/* Same icons as the buttons on each card, so the legend matches. */}
          <View style={{ gap: space.xs }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: space.xs }}>
              <Text size={13} tone="muted">Touche </Text>
              <ReshuffleIcon size={16} color={color.accent400} />
              <Text size={13} tone="muted"> pour une autre idée, </Text>
              <CloseIcon size={14} color={color.neutral500} />
              <Text size={13} tone="muted"> pour laisser le créneau vide.</Text>
            </View>
            <Text size={13} tone="muted">
              Rien n'est enregistré avant de valider.
            </Text>
          </View>
          {quota && quota.period !== "premium" && (
            <Text size={13} tone="faint">
              {rerollsLeft > 0 ? `${rerollsLeft} « autre idée » restante${rerollsLeft > 1 ? "s" : ""}.` : "Plus d'« autre idée » disponible."}
            </Text>
          )}
          {byDay.map(({ day, items }) => (
            <View key={day} style={{ gap: space.sm }}>
              <Text size={13} weight="semibold">
                {WEEKDAYS_FULL[day]}
              </Text>
              {items.map((m) => {
                const key = `${m.weekday}|${m.type}`;
                const busy = rerolling === key;
                return (
                  <Card key={key} row style={{ alignItems: "center", opacity: busy ? 0.5 : 1 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text size={12} tone="faint" style={{ textTransform: "capitalize" }}>
                        {m.type}
                        {m.recipeId ? " · ma recette" : ""}
                      </Text>
                      <Text size={15} weight="medium">
                        {busy ? "Nouvelle idée…" : m.title}
                      </Text>
                      {!busy && m.notes ? (
                        <Text size={13} tone="muted">
                          {m.notes}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => onReroll(m)}
                      disabled={!!rerolling}
                      hitSlop={8}
                      accessibilityLabel={`Autre idée pour ${m.type} ${WEEKDAYS_FULL[m.weekday]}`}
                      style={{ padding: space.sm }}
                    >
                      <ReshuffleIcon size={16} color={color.accent400} />
                    </Pressable>
                    <Pressable
                      onPress={() => onRemove(m)}
                      disabled={!!rerolling}
                      hitSlop={8}
                      accessibilityLabel={`Retirer ${m.type} ${WEEKDAYS_FULL[m.weekday]}`}
                      style={{ padding: space.sm }}
                    >
                      <CloseIcon size={14} color={color.neutral500} />
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          ))}
          <Button
            label={`Ajouter ${proposal.length} repas au menu`}
            variant="primary"
            block
            onPress={onSave}
            loading={save.isPending}
            needsNetwork
            disabled={!!rerolling || proposal.length === 0}
          />
          <Button
            label={weeksLeft > 0 ? "Tout régénérer (compte comme une génération)" : "Tout régénérer · Repas+"}
            variant="secondary"
            block
            onPress={weeksLeft > 0 ? onGenerate : () => router.push("/premium")}
            loading={generate.isPending && !rerolling}
            needsNetwork
            disabled={!!rerolling}
          />
        </KeyboardScrollView>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={`Menus · ${weekTitle(week).toLowerCase()}`} onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.push("/famille")}>
          <Text size={13} tone="faint">
            Les goûts, régimes et allergies de chaque membre (onglet Famille, fiche du membre, rubrique Repas) sont aussi pris en compte.
          </Text>
        </Pressable>
        <Question title="Quels jours ?">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {ALL_DAYS.map((d) => (
              <Chip key={d} label={WEEKDAYS_SHORT[d]} size="sm" selected={days.includes(d)} onPress={() => setDays((v) => toggle(v, d))} />
            ))}
          </View>
        </Question>

        <Question title="Quels repas ?">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {MEAL_TYPES.map((t) => (
              <Chip key={t} label={t[0].toUpperCase() + t.slice(1)} size="sm" selected={types.includes(t)} onPress={() => setTypes((v) => toggle(v, t))} />
            ))}
          </View>
        </Question>

        {filled > 0 && (
          <ChipPicker
            label={`${filled} de ces repas sont déjà prévus. On en fait quoi ?`}
            options={[
              { value: "empty", label: "Les garder" },
              { value: "all", label: "Tout remplacer" },
            ]}
            selected={mode}
            onSelect={(v) => v && setMode(v as FillMode)}
          />
        )}

        <Question title="Régime alimentaire">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {DIET_OPTIONS.map((o) => (
              <Chip key={o.value} label={o.label} size="sm" selected={prefs.diets.includes(o.value)} onPress={() => update("diets", toggle(prefs.diets, o.value))} />
            ))}
          </View>
        </Question>
        <TextField label="Allergies ou intolérances" value={prefs.allergies} onChangeText={(v) => update("allergies", v)} placeholder="Ex. arachides, fruits à coque…" />

        <ChipPicker
          label="Temps pour cuisiner en semaine"
          options={COOK_TIME_OPTIONS}
          selected={prefs.weekdayTime}
          onSelect={(v) => v && update("weekdayTime", v as MealPlanPreferences["weekdayTime"])}
        />
        <ChipPicker
          label="Et le week-end"
          options={COOK_TIME_OPTIONS}
          selected={prefs.weekendTime}
          onSelect={(v) => v && update("weekendTime", v as MealPlanPreferences["weekendTime"])}
        />

        <ChipPicker
          label="Repas avec du poisson par semaine"
          options={PER_WEEK_OPTIONS}
          selected={perWeekValue(prefs.fishPerWeek)}
          onSelect={(v) => update("fishPerWeek", perWeekFromValue(v))}
        />
        <ChipPicker
          label="Repas végétariens par semaine"
          options={PER_WEEK_OPTIONS}
          selected={perWeekValue(prefs.veggiePerWeek)}
          onSelect={(v) => update("veggiePerWeek", perWeekFromValue(v))}
        />
        <ChipPicker
          label="Reprendre mes recettes enregistrées"
          options={RECIPE_USAGE_OPTIONS}
          selected={prefs.useMyRecipes}
          onSelect={(v) => v && update("useMyRecipes", v as MealPlanPreferences["useMyRecipes"])}
        />

        <TextField label="Envies (facultatif)" value={prefs.wishes} onChangeText={(v) => update("wishes", v)} placeholder="Ex. plats d'hiver, une soirée pizza le vendredi…" />
        <TextField label="À éviter (facultatif)" value={prefs.avoid} onChangeText={(v) => update("avoid", v)} placeholder="Ex. champignons, poivrons…" />

        <Button
          label={weeksLeft <= 0 ? "Repas+ pour générer" : slots.length ? `Proposer ${slots.length} repas` : "Rien à proposer"}
          variant="primary"
          block
          onPress={weeksLeft <= 0 ? () => router.push("/premium") : onGenerate}
          loading={generate.isPending}
          needsNetwork
          disabled={weeksLeft > 0 && slots.length === 0}
        />
        {quota && (
          <Pressable onPress={() => router.push("/premium")} disabled={quota.period === "premium"}>
            <Text size={13} tone={weeksLeft > 0 ? "faint" : "accent"} center>
              {mealQuotaLabel(quota)}
            </Text>
            {quota.period !== "premium" && <MoreLink label="Repas+ : chaque semaine" center />}
          </Pressable>
        )}
        {slow && (
          <Text size={13} tone="muted" center>
            Claude compose ta semaine, ça prend quelques secondes…
          </Text>
        )}
      </KeyboardScrollView>
    </Screen>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text size={13} tone="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}
