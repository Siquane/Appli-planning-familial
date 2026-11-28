import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Button } from "../src/components/Button";
import { TextField } from "../src/components/TextField";
import { TopBar } from "../src/components/TopBar";
import { Avatar } from "../src/components/Avatar";
import { DateField } from "../src/components/DateField";
import { CheckIcon, GiftIcon, PartyIcon, PlusIcon, TrashIcon } from "../src/components/icons";
import { useBirthdays, useBirthdaysMutation, useMembers, useUpdateMember } from "../src/hooks/useApi";
import { birthdaysApi } from "../src/api/resources";
import { daysUntilBirthday } from "../src/lib/notifications";
import { errorText } from "../src/lib/errors";
import { useToastStore } from "../src/state/toastStore";
import { useIsChildAccount } from "../src/state/authStore";
import { color, space, gutter } from "../src/theme/tokens";
import type { BirthdayContact, GiftIdea, Member } from "../src/api/types";

// Anniversaires : la famille (date sur la fiche du membre) et les proches
// (grands-parents, amis…), une liste d'idées de cadeaux par personne, et un
// rappel quelques jours avant pour avoir le temps d'acheter le cadeau.
// Les comptes enfants voient les dates, pas les cadeaux.

const toast = (m: string) => useToastStore.getState().show(m);
const REMIND = [0, 3, 7, 14];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function daysLabel(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const contactDate = (c: BirthdayContact) => `${c.birthday}T12:00:00`;
/** Âge à son prochain anniversaire, quand on connaît l'année. */
function nextAge(birthday: string): number {
  const b = new Date(birthday);
  const days = daysUntilBirthday(birthday);
  const next = new Date(Date.now() + days * 86_400_000);
  return next.getFullYear() - b.getFullYear();
}

function Gifts({ gifts, owner }: { gifts: GiftIdea[]; owner: { memberId?: string; contactId?: string } }) {
  const [title, setTitle] = useState("");
  const add = useBirthdaysMutation((t: string) => birthdaysApi.addGift({ ...owner, title: t }));
  const toggle = useBirthdaysMutation((g: GiftIdea) => birthdaysApi.updateGift(g.id, { bought: !g.bought }));
  const remove = useBirthdaysMutation((id: string) => birthdaysApi.removeGift(id));
  return (
    <View style={{ gap: space.xs }}>
      <Text size={12} tone="faint">
        Idées de cadeaux
      </Text>
      {gifts.map((g) => (
        <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: g.bought }}
            accessibilityLabel={`${g.title}, ${g.bought ? "acheté" : "pas encore acheté"}`}
            onPress={() => toggle.mutate(g)}
            hitSlop={8}
            style={{ width: 26, height: 26, borderRadius: 6, borderWidth: 2, borderColor: g.bought ? color.accent500 : color.neutral600, backgroundColor: g.bought ? color.accent600 : "transparent", alignItems: "center", justifyContent: "center" }}
          >
            {g.bought ? <CheckIcon size={14} color={color.neutral100} /> : null}
          </Pressable>
          <Text size={14} tone={g.bought ? "muted" : undefined} style={{ flex: 1, textDecorationLine: g.bought ? "line-through" : "none" }}>
            {g.title}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer « ${g.title} »`} hitSlop={8} onPress={() => remove.mutate(g.id)}>
            <TrashIcon size={16} color={color.neutral500} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <TextField label="Nouvelle idée" value={title} onChangeText={setTitle} placeholder="Ex. Un livre de jardinage" maxLength={120} />
        </View>
        <Button
          variant="icon"
          icon={<PlusIcon size={18} color={color.neutral100} />}
          accessibilityLabel="Ajouter l'idée"
          disabled={!title.trim()}
          needsNetwork
          loading={add.isPending}
          onPress={() => add.mutate(title.trim(), { onSuccess: () => setTitle(""), onError: (e) => toast(errorText(e, "ajouter l'idée")) })}
        />
      </View>
    </View>
  );
}

function ContactForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [yearKnown, setYearKnown] = useState(false);
  const add = useBirthdaysMutation((d: { name: string; relation: string; birthday: string; yearKnown: boolean }) => birthdaysApi.addContact(d));
  return (
    <Card style={{ gap: space.sm }}>
      <Text weight="medium" size={15}>
        Ajouter un proche
      </Text>
      <TextField label="Prénom" value={name} onChangeText={setName} placeholder="Ex. Mamie, Tom" maxLength={60} />
      <TextField label="Qui est-ce ? (facultatif)" value={relation} onChangeText={setRelation} placeholder="Ex. Grand-mère, ami de Léo" maxLength={40} />
      <DateField label="Date d'anniversaire" value={date} onChange={setDate} />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Chip label="Je connais l'année" selected={yearKnown} onPress={() => setYearKnown(true)} size="sm" />
        <Chip label="Seulement le jour" selected={!yearKnown} onPress={() => setYearKnown(false)} size="sm" />
      </View>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button label="Annuler" variant="ghost" style={{ flex: 1 }} onPress={onDone} />
        <Button
          label="Ajouter"
          variant="primary"
          style={{ flex: 1 }}
          disabled={!name.trim() || !date}
          needsNetwork
          loading={add.isPending}
          onPress={() =>
            date &&
            add.mutate(
              { name: name.trim(), relation: relation.trim(), birthday: isoDay(date), yearKnown },
              { onSuccess: () => { toast(`${name.trim()} est ajouté.`); onDone(); }, onError: (e) => toast(errorText(e, "ajouter ce proche")) },
            )
          }
        />
      </View>
    </Card>
  );
}

export default function BirthdaysScreen() {
  const { data: members = [] } = useMembers();
  const { data } = useBirthdays();
  const updateMember = useUpdateMember();
  const isChild = useIsChildAccount();
  const setRemind = useBirthdaysMutation((n: number) => birthdaysApi.setRemindDays(n));
  const removeContact = useBirthdaysMutation((id: string) => birthdaysApi.removeContact(id));
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const gifts = data?.gifts ?? [];
  const contacts = [...(data?.contacts ?? [])].sort((a, b) => daysUntilBirthday(contactDate(a)) - daysUntilBirthday(contactDate(b)));

  const sorted = [...members].sort((a, b) => {
    if (!a.birthday && !b.birthday) return 0;
    if (!a.birthday) return 1;
    if (!b.birthday) return -1;
    return daysUntilBirthday(a.birthday) - daysUntilBirthday(b.birthday);
  });

  const giftsOf = (id: string) => gifts.filter((g) => g.memberId === id || g.contactId === id);
  const giftsButton = (id: string) => {
    const list = giftsOf(id);
    const left = list.filter((g) => !g.bought).length;
    return (
      <Button
        variant="ghost"
        icon={<GiftIcon size={16} color={color.accent400} />}
        label={open === id ? "Fermer les idées" : list.length ? `${list.length} idée${list.length > 1 ? "s" : ""} de cadeau${left && left < list.length ? ` · ${left} à acheter` : ""}` : "Idées de cadeaux"}
        onPress={() => setOpen(open === id ? null : id)}
      />
    );
  };

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Anniversaires" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: gutter, gap: space.sm, paddingBottom: 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!isChild && (
          <Card style={{ gap: space.sm }}>
            <Text weight="medium" size={15}>
              Me prévenir
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {REMIND.map((n) => (
                <Chip
                  key={n}
                  size="sm"
                  label={n === 0 ? "Le jour J" : `${n} jours avant`}
                  selected={(data?.remindDays ?? 7) === n}
                  onPress={() => setRemind.mutate(n, { onError: (e) => toast(errorText(e, "enregistrer")) })}
                />
              ))}
            </View>
            <Text size={12} tone="faint">
              Un rappel le jour J, et un autre avant pour avoir le temps d'acheter le cadeau.
            </Text>
          </Card>
        )}

        <Text weight="medium" size={13} tone="muted" style={{ marginTop: space.sm }}>
          La famille
        </Text>
        {sorted.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space.xl }}>
            <GiftIcon size={22} color={color.neutral600} />
            <Text tone="muted" size={13} center style={{ marginTop: space.sm }}>
              Ajoute d'abord des membres dans l'onglet Famille.
            </Text>
          </Card>
        )}
        {sorted.map((member: Member) => (
          <Card key={member.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Avatar initials={member.initials} bg={member.tint === "neutral" ? color.neutral700 : color.accent800} fg={member.tint === "neutral" ? color.neutral100 : color.accent100} size={32} />
              <Text weight="medium" size={15} style={{ flex: 1 }}>
                {member.name}
              </Text>
              {member.birthday && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
                  <Text size={13} tone="accent" mono>
                    {daysLabel(daysUntilBirthday(member.birthday))}
                  </Text>
                  {daysUntilBirthday(member.birthday) === 0 && <PartyIcon size={14} color={color.accent400} />}
                </View>
              )}
            </View>
            {!isChild && (
              <DateField label="Date de naissance" value={member.birthday ? new Date(member.birthday) : null} onChange={(date) => updateMember.mutate({ id: member.id, data: { birthday: date.toISOString() } })} />
            )}
            {!isChild && member.birthday ? giftsButton(member.id) : null}
            {!isChild && open === member.id ? <Gifts gifts={giftsOf(member.id)} owner={{ memberId: member.id }} /> : null}
          </Card>
        ))}

        <Text weight="medium" size={13} tone="muted" style={{ marginTop: space.md }}>
          Les proches
        </Text>
        {contacts.length === 0 && !adding && (
          <Text size={13} tone="faint">
            Grands-parents, cousins, amis des enfants : ajoute leur anniversaire pour ne plus l'oublier.
          </Text>
        )}
        {contacts.map((c) => {
          const days = daysUntilBirthday(contactDate(c));
          const [, m, d] = c.birthday.split("-").map(Number);
          return (
            <Card key={c.id} style={{ gap: space.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Avatar initials={c.name.slice(0, 1).toUpperCase()} bg={color.neutral700} fg={color.neutral100} size={32} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium" size={15}>
                    {c.name}
                  </Text>
                  <Text size={12} tone="faint">
                    {[c.relation, `${d} ${MONTHS[m - 1]}${c.yearKnown ? ` (${nextAge(contactDate(c))} ans)` : ""}`].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text size={13} tone="accent" mono>
                  {daysLabel(days)}
                </Text>
                {days === 0 && <PartyIcon size={14} color={color.accent400} />}
                {!isChild && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${c.name}`}
                    hitSlop={8}
                    onPress={() =>
                      Alert.alert("Retirer ce proche", `Retirer ${c.name} et ses idées de cadeaux ?`, [
                        { text: "Annuler", style: "cancel" },
                        { text: "Retirer", style: "destructive", onPress: () => removeContact.mutate(c.id) },
                      ])
                    }
                  >
                    <TrashIcon size={16} color={color.neutral500} />
                  </Pressable>
                )}
              </View>
              {!isChild ? giftsButton(c.id) : null}
              {!isChild && open === c.id ? <Gifts gifts={giftsOf(c.id)} owner={{ contactId: c.id }} /> : null}
            </Card>
          );
        })}
        {!isChild && (adding ? <ContactForm onDone={() => setAdding(false)} /> : <Button label="Ajouter un proche" variant="secondary" block icon={<PlusIcon size={16} color={color.neutral100} />} onPress={() => setAdding(true)} />)}
      </ScrollView>
    </Screen>
  );
}
