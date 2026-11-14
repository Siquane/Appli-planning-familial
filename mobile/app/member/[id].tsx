import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { ChipPicker } from "../../src/components/ChipPicker";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { Accordion } from "../../src/components/Accordion";
import { MealIcon } from "../../src/components/icons";
import { useFoodConsent, useMembers, useSetFoodConsent, useUpdateMember } from "../../src/hooks/useApi";
import { APPETITE_OPTIONS, CANTEEN_DAY_OPTIONS, MEMBER_DIET_OPTIONS, foodSummary, toggle } from "../../src/lib/memberFood";
import { useToastStore } from "../../src/state/toastStore";
import { color, space } from "../../src/theme/tokens";
import type { Appetite, MemberDiet } from "../../src/api/types";

// A family member's page: name, age and the « Repas » preferences that tailor
// generated menus. Diets, allergies and foods to limit are health-related
// (RGPD art. 9): they need the account's explicit consent first.
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: members = [] } = useMembers();
  const member = members.find((m) => m.id === id);
  const { data: consentedAt } = useFoodConsent();
  const setConsent = useSetFoodConsent();
  const update = useUpdateMember();
  const consented = !!consentedAt;

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [favoriteFoods, setFavoriteFoods] = useState("");
  const [dislikedFoods, setDislikedFoods] = useState("");
  const [appetite, setAppetite] = useState<Appetite | null>(null);
  const [canteenDays, setCanteenDays] = useState<number[]>([]);
  const [foodNotes, setFoodNotes] = useState("");
  const [diets, setDiets] = useState<MemberDiet[]>([]);
  const [allergies, setAllergies] = useState("");
  const [foodsToLimit, setFoodsToLimit] = useState("");

  // Fill the form once the member is loaded (and again if the server erased
  // the sensitive fields after a consent withdrawal).
  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setAge(member.age != null ? String(member.age) : "");
    setFavoriteFoods(member.favoriteFoods);
    setDislikedFoods(member.dislikedFoods);
    setAppetite(member.appetite);
    setCanteenDays(member.canteenDays);
    setFoodNotes(member.foodNotes);
    setDiets(member.diets);
    setAllergies(member.allergies);
    setFoodsToLimit(member.foodsToLimit);
  }, [member]);

  if (!member) {
    return (
      <Screen>
        <TopBar title="Membre" onBack={() => router.back()} />
        <Text tone="muted">Ce membre n'existe plus.</Text>
      </Screen>
    );
  }

  const ageValue = age.trim() === "" ? null : Number(age);
  const ageInvalid = ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 0 || ageValue > 120);

  async function onSave() {
    if (!name.trim() || ageInvalid) return;
    try {
      await update.mutateAsync({
        id: member!.id,
        data: {
          name: name.trim(),
          age: ageValue,
          favoriteFoods,
          dislikedFoods,
          appetite,
          canteenDays: [...canteenDays].sort(),
          foodNotes,
          ...(consented ? { diets, allergies, foodsToLimit } : {}),
        },
      });
      useToastStore.getState().show("Fiche enregistrée.");
      router.back();
    } catch (e) {
      useToastStore.getState().show(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={member.name} onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: 22, gap: space[4] }} showsVerticalScrollIndicator={false}>
        <Card style={{ gap: space[4] }}>
          <TextField label="Prénom" value={name} onChangeText={setName} />
          <TextField label="Âge (facultatif)" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="Ex. 8" />
          {ageInvalid ? (
            <Text size={12} tone="danger">
              Âge entre 0 et 120 ans.
            </Text>
          ) : null}
        </Card>

        <Accordion
          title="Repas"
          summary={foodSummary({ favoriteFoods, dislikedFoods, appetite, canteenDays, foodNotes, diets, allergies, foodsToLimit })}
          icon={<MealIcon size={16} color={color.neutral400} />}
        >
          <Text size={12} tone="faint">
            Sert à adapter les menus générés. Claude reçoit ces infos sans le prénom (« Enfant 1 », « Adulte 2 »).
          </Text>
          <TextField label="Plats préférés" value={favoriteFoods} onChangeText={setFavoriteFoods} placeholder="Ex. lasagnes, crêpes, poulet rôti" multiline />
          <TextField label="N'aime pas" value={dislikedFoods} onChangeText={setDislikedFoods} placeholder="Ex. champignons, poisson" multiline />
          <ChipPicker
            label="Appétit"
            options={APPETITE_OPTIONS}
            selected={appetite}
            onSelect={(v) => setAppetite(v as Appetite | null)}
            optional
          />
          <View style={{ gap: space[2] }}>
            <Text size={13} tone="muted">
              Déjeune à la cantine
            </Text>
            <View style={{ flexDirection: "row", gap: space[2] }}>
              {CANTEEN_DAY_OPTIONS.map((d) => (
                <Chip key={d.value} label={d.label} size="sm" fill selected={canteenDays.includes(d.value)} onPress={() => setCanteenDays((c) => toggle(c, d.value))} />
              ))}
            </View>
          </View>
          <TextField label="Notes" value={foodNotes} onChangeText={setFoodNotes} placeholder="Ex. mange lentement, aime aider en cuisine" multiline />

          <View style={{ gap: space[3], borderTopWidth: 1, borderTopColor: color.divider, paddingTop: space[4] }}>
            <Text size={14} weight="medium">
              Santé et régime
            </Text>
            {consented ? (
              <>
                <View style={{ gap: space[2] }}>
                  <Text size={13} tone="muted">
                    Régime alimentaire
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
                    {MEMBER_DIET_OPTIONS.map((o) => (
                      <Chip key={o.value} label={o.label} size="sm" selected={diets.includes(o.value)} onPress={() => setDiets((d) => toggle(d, o.value))} />
                    ))}
                  </View>
                </View>
                <TextField label="Allergies / intolérances" value={allergies} onChangeText={setAllergies} placeholder="Ex. arachides, lactose" multiline />
                <TextField label="Aliments à limiter" value={foodsToLimit} onChangeText={setFoodsToLimit} placeholder="Ex. sucre, sel" multiline />
                <Pressable onPress={() => router.push("/privacy")}>
                  <Text size={12} tone="faint">
                    Ton accord peut être retiré à tout moment, dans Profil, rubrique Confidentialité.
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text size={13} tone="muted">
                  Le régime, les allergies et les aliments à limiter sont des données de santé (ou peuvent révéler une religion). Pour les enregistrer, Passerelle a besoin de ton accord explicite, valable pour toute la famille.
                </Text>
                <Text size={12} tone="faint">
                  Elles servent uniquement à adapter les menus, sont transmises à Claude (Anthropic) sans prénom au moment de générer, et sont effacées si tu retires ton accord.
                </Text>
                <Button
                  label="J'accepte d'enregistrer ces infos"
                  variant="secondary"
                  block
                  loading={setConsent.isPending}
                  onPress={() => setConsent.mutate(true)}
                />
                <Pressable onPress={() => router.push("/privacy")}>
                  <Text size={12} tone="faint">
                    En savoir plus : Profil, rubrique Confidentialité
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Accordion>

        <Button label="Enregistrer" variant="primary" block loading={update.isPending} disabled={!name.trim() || ageInvalid} onPress={onSave} />
      </KeyboardScrollView>
    </Screen>
  );
}
