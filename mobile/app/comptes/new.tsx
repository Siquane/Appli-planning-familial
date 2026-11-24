import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { CloseIcon } from "../../src/components/icons";
import { splitsApi } from "../../src/api/resources";
import { useMembers, useSplitMutation } from "../../src/hooks/useApi";
import { useAuthStore } from "../../src/state/authStore";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { GROUP_EMOJIS } from "../../src/lib/splits";
import { color, gutter, radius, space } from "../../src/theme/tokens";

type Person = { name: string; memberId: string | null };

// Nouveau groupe de dépenses partagées : son nom, et qui en fait partie
// (moi d'abord, des membres de la famille, et des gens de l'extérieur par
// leur prénom).
export default function NewGroupScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useMembers();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0]);
  const [people, setPeople] = useState<Person[]>(() => [{ name: user?.name?.trim().split(/\s+/)[0] || "Moi", memberId: user?.childMemberId ?? null }]);
  const [other, setOther] = useState("");
  const create = useSplitMutation(splitsApi.create);

  const hasMember = (id: string) => people.some((p) => p.memberId === id);
  const toggleMember = (id: string, memberName: string) =>
    setPeople((ps) => (hasMember(id) ? ps.filter((p) => p.memberId !== id) : [...ps, { name: memberName, memberId: id }]));
  const addOther = () => {
    const n = other.trim();
    if (!n) return;
    setPeople((ps) => [...ps, { name: n, memberId: null }]);
    setOther("");
  };

  const valid = name.trim().length > 0 && people.length >= 2;
  const save = () =>
    create.mutate(
      { name: name.trim(), emoji, participants: people },
      {
        onSuccess: (r) => router.replace(`/comptes/${r.group.id}`),
        onError: (e) => useToastStore.getState().show(errorText(e, "créer le groupe")),
      },
    );

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Nouveau groupe" onBack={() => router.back()} save={{ onPress: save, disabled: !valid, loading: create.isPending, label: "Créer" }} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        <TextField label="Nom du groupe" value={name} onChangeText={setName} placeholder="Ex. Enfants avec Marc, Vacances été" maxLength={60} />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Icône
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {GROUP_EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="radio"
                accessibilityState={{ selected: emoji === e }}
                style={{ width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: emoji === e ? color.accent : color.divider }}
              >
                <Text size={24}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Qui partage ? ({people.length})
          </Text>
          {people.map((p, i) => (
            <Card key={`${p.name}-${i}`} row style={{ alignItems: "center" }}>
              <Text size={15} style={{ flex: 1 }}>
                {p.name}
                {i === 0 ? "  (toi)" : p.memberId ? "  · famille" : ""}
              </Text>
              {i > 0 ? (
                <Pressable onPress={() => setPeople((ps) => ps.filter((_, j) => j !== i))} accessibilityLabel={`Retirer ${p.name}`} hitSlop={10}>
                  <CloseIcon size={16} color={color.neutral400} />
                </Pressable>
              ) : null}
            </Card>
          ))}

          {members.length > 0 && (
            <View style={{ gap: space.xs }}>
              <Text size={12} tone="faint">
                Ajouter quelqu'un de la famille
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {members
                  .filter((m) => m.id !== people[0]?.memberId)
                  .map((m) => (
                    <Chip key={m.id} label={m.name} selected={hasMember(m.id)} onPress={() => toggleMember(m.id, m.name)} size="sm" />
                  ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <TextField label="Quelqu'un d'autre (l'autre parent, un ami…)" value={other} onChangeText={setOther} placeholder="Prénom" maxLength={40} onSubmitEditing={addOther} returnKeyType="done" />
            </View>
            <Button label="Ajouter" onPress={addOther} disabled={!other.trim()} />
          </View>
          {people.length < 2 ? (
            <Text size={12} tone="faint">
              Ajoute au moins une autre personne.
            </Text>
          ) : null}
        </View>

        <Button label="Créer le groupe" variant="primary" block onPress={save} disabled={!valid} loading={create.isPending} />
      </KeyboardScrollView>
    </Screen>
  );
}
