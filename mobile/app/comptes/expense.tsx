import { useEffect, useMemo, useState } from "react";
import { Alert, Image, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Pressable } from "../../src/components/Touchable";
import { Text } from "../../src/components/Text";
import { Card } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { TextField } from "../../src/components/TextField";
import { DateField } from "../../src/components/DateField";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { CheckIcon } from "../../src/components/icons";
import { splitsApi } from "../../src/api/resources";
import { useSplitGroup, useSplitGroups, useSplitMutation } from "../../src/hooks/useApi";
import { centsToInput, formatEuros, fromDayString, parseAmount, toDayString } from "../../src/lib/money";
import { findMe, previewShares, SPLIT_MODE_LABELS } from "../../src/lib/splits";
import { pickFile, type PickedFile } from "../../src/lib/documentUpload";
import { useAuthStore } from "../../src/state/authStore";
import { useToastStore } from "../../src/state/toastStore";
import { errorText } from "../../src/lib/errors";
import { color, gutter, radius, space } from "../../src/theme/tokens";
import type { SplitExpenseInput, SplitMode } from "../../src/api/types";

const MODES: SplitMode[] = ["equal", "percent", "amount", "shares"];

/** Ce qu'on tape (« 60 », « 12,50 », « 2 ») → la valeur envoyée au serveur. */
function toValue(mode: SplitMode, input: string): number {
  if (mode === "equal") return 1;
  if (mode === "amount") return parseAmount(input) ?? 0;
  const n = Number(input.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return mode === "percent" ? Math.round(n * 100) : Math.round(n);
}

function toInput(mode: SplitMode, value: number): string {
  if (mode === "amount") return centsToInput(value);
  if (mode === "percent") return String(value / 100).replace(".", ",");
  return String(value);
}

/** Ouvert depuis le « + » sans groupe : on choisit d'abord le groupe. */
function PickGroup() {
  const { data: groups = [] } = useSplitGroups();
  const active = groups.filter((g) => !g.archived);
  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Nouvelle dépense" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.sm }}>
        <Text size={13} tone="muted">
          Dans quel groupe ?
        </Text>
        {active.map((g) => (
          <Pressable key={g.id} onPress={() => router.replace(`/comptes/expense?group=${g.id}`)} accessibilityRole="button">
            <Card row style={{ alignItems: "center", gap: space.md }}>
              <Text size={24}>{g.emoji}</Text>
              <Text size={16} weight="medium" style={{ flex: 1 }}>
                {g.name}
              </Text>
            </Card>
          </Pressable>
        ))}
        <Button label="Nouveau groupe" variant={active.length ? "ghost" : "primary"} block onPress={() => router.replace("/comptes/new")} />
      </KeyboardScrollView>
    </Screen>
  );
}

// Ajouter ou modifier une dépense d'un groupe : combien, qui a payé, et pour
// qui, à parts égales, en %, en montants ou en parts ; photo du ticket.
export default function SplitExpenseRoute() {
  const { group } = useLocalSearchParams<{ group?: string }>();
  return group ? <SplitExpenseScreen /> : <PickGroup />;
}

function SplitExpenseScreen() {
  const { group: groupId, edit } = useLocalSearchParams<{ group: string; edit?: string }>();
  const { data: g } = useSplitGroup(groupId);
  const user = useAuthStore((s) => s.user);
  const existing = g?.expenses?.find((e) => e.id === edit);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidById, setPaidById] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [mode, setMode] = useState<SplitMode>("equal");
  const [checked, setChecked] = useState<string[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [remember, setRemember] = useState(false);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Fill in once: the expense being edited, or the group's remembered split, or everyone equally.
  useEffect(() => {
    if (!g || ready) return;
    const me = findMe(g.participants, user ? { name: user.name, memberId: user.childMemberId } : null);
    if (existing) {
      setTitle(existing.title);
      setAmount(centsToInput(existing.amountCents));
      setPaidById(existing.paidById);
      setDate(fromDayString(existing.date));
      setMode(existing.mode);
      setChecked(existing.shares.map((s) => s.participantId));
      setInputs(Object.fromEntries(existing.shares.map((s) => [s.participantId, toInput(existing.mode, s.value)])));
    } else {
      setPaidById(me?.id ?? g.participants[0]?.id ?? null);
      const d = g.defaultSplit;
      if (d && Object.keys(d.values).some((pid) => g.participants.some((p) => p.id === pid))) {
        setMode(d.mode);
        setChecked(g.participants.filter((p) => p.id in d.values).map((p) => p.id));
        setInputs(Object.fromEntries(Object.entries(d.values).map(([pid, v]) => [pid, toInput(d.mode, v)])));
      } else {
        setChecked(g.participants.map((p) => p.id));
      }
    }
    setReady(true);
  }, [g, existing, ready, user]);

  const amountCents = parseAmount(amount) ?? 0;
  const ordered = (g?.participants ?? []).filter((p) => checked.includes(p.id));
  const values = ordered.map((p) => toValue(mode, inputs[p.id] ?? ""));
  const preview = useMemo(() => previewShares(amountCents, mode, values), [amountCents, mode, values.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useSplitMutation((body: SplitExpenseInput) => (existing ? splitsApi.updateExpense(groupId!, existing.id, body) : splitsApi.addExpense(groupId!, body)));
  const remove = useSplitMutation((eid: string) => splitsApi.removeExpense(groupId!, eid));

  const valid = !!g && title.trim().length > 0 && amountCents > 0 && !!paidById && ordered.length > 0 && !preview.problem;

  async function onSave() {
    if (!valid || !paidById) return;
    setSaving(true);
    try {
      let blob: Blob | null = null;
      if (photo) blob = await (await fetch(photo.uri)).blob();
      const r = await save.mutateAsync({
        title: title.trim(),
        amountCents,
        paidById,
        date: toDayString(date),
        mode,
        shares: ordered.map((p, i) => ({ participantId: p.id, value: values[i] })),
        remember,
        photo: blob && photo ? { mimeType: photo.mimeType, size: blob.size || photo.size || 1 } : null,
      });
      if (blob && r.upload) {
        const put = await fetch(r.upload.url, { method: r.upload.method, headers: r.upload.headers, body: blob });
        if (!put.ok) useToastStore.getState().show("La dépense est enregistrée, mais pas la photo. Réessaie de l'ajouter.");
      }
      router.back();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer la dépense"));
    } finally {
      setSaving(false);
    }
  }

  async function addPhoto(source: "camera" | "photos") {
    try {
      const picked = await pickFile(source);
      if (picked) setPhoto(picked);
    } catch (e) {
      useToastStore.getState().show(errorText(e, "ajouter la photo"));
    }
  }

  function confirmDelete() {
    if (!existing) return;
    Alert.alert("Supprimer la dépense ?", `${existing.title} : ${formatEuros(existing.amountCents)}`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => remove.mutate(existing.id, { onSuccess: () => router.back(), onError: (e) => useToastStore.getState().show(errorText(e, "supprimer la dépense")) }) },
    ]);
  }

  const toggle = (pid: string) => setChecked((c) => (c.includes(pid) ? c.filter((x) => x !== pid) : [...c, pid]));
  const photoUri = photo?.uri ?? existing?.photoUrl ?? null;
  const unit = mode === "percent" ? "%" : mode === "amount" ? "€" : mode === "shares" ? "part(s)" : "";

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Modifier la dépense" : "Nouvelle dépense"} onBack={() => router.back()} onDelete={existing ? confirmDelete : undefined} save={{ onPress: () => void onSave(), disabled: !valid, loading: saving }} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        <TextField label="Montant (€)" value={amount} onChangeText={setAmount} placeholder="Ex. 42,50" keyboardType="decimal-pad" autoFocus={!existing} />
        <TextField label="Pour quoi ?" value={title} onChangeText={setTitle} placeholder="Ex. Courses, cantine, essence" maxLength={80} />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Payé par
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {(g?.participants ?? []).map((p) => (
              <Chip key={p.id} label={p.name} selected={paidById === p.id} onPress={() => setPaidById(p.id)} size="sm" />
            ))}
          </View>
        </View>

        <DateField label="Date" value={date} onChange={setDate} />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Pour qui, et comment partager ?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {MODES.map((m) => (
              <Chip key={m} label={SPLIT_MODE_LABELS[m]} selected={mode === m} onPress={() => setMode(m)} size="sm" />
            ))}
          </View>
          <Card style={{ gap: space.sm }}>
            {(g?.participants ?? []).map((p) => {
              const on = checked.includes(p.id);
              const i = ordered.findIndex((x) => x.id === p.id);
              return (
                <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44 }}>
                  <Pressable
                    onPress={() => toggle(p.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={p.name}
                    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 }}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: radius.sm, borderWidth: 2, borderColor: on ? color.accent : color.neutral500, backgroundColor: on ? color.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {on ? <CheckIcon size={14} color={color.bg} /> : null}
                    </View>
                    <Text size={15}>{p.name}</Text>
                  </Pressable>
                  {on && mode !== "equal" ? (
                    <View style={{ width: 92 }}>
                      <TextField
                        value={inputs[p.id] ?? ""}
                        onChangeText={(t) => setInputs((v) => ({ ...v, [p.id]: t }))}
                        placeholder={unit}
                        keyboardType="decimal-pad"
                        accessibilityLabel={`${p.name}, ${unit}`}
                      />
                    </View>
                  ) : null}
                  <Text size={14} tone={on ? undefined : "faint"} style={{ width: 84, textAlign: "right" }}>
                    {on && i >= 0 && amountCents > 0 ? formatEuros(preview.amounts[i] ?? 0) : "—"}
                  </Text>
                </View>
              );
            })}
          </Card>
          {amountCents > 0 && preview.problem ? (
            <Text size={13} style={{ color: color.danger }}>
              {preview.problem}
            </Text>
          ) : null}
          <Pressable onPress={() => setRemember((r) => !r)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs }}>
            <View style={{ width: 22, height: 22, borderRadius: radius.sm, borderWidth: 2, borderColor: remember ? color.accent : color.neutral500, backgroundColor: remember ? color.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
              {remember ? <CheckIcon size={12} color={color.bg} /> : null}
            </View>
            <Text size={14}>Retenir ce partage pour les prochaines dépenses</Text>
          </Pressable>
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Ticket (facultatif)
          </Text>
          {photoUri ? <Image source={{ uri: photoUri }} style={{ width: "100%", height: 220, borderRadius: radius.md, backgroundColor: color.neutral800 }} resizeMode="cover" accessibilityLabel="Photo du ticket" /> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Button label={photoUri ? "Reprendre" : "Prendre en photo"} onPress={() => void addPhoto("camera")} style={{ flex: 1 }} />
            <Button label="Choisir" variant="ghost" onPress={() => void addPhoto("photos")} />
          </View>
        </View>

        <Button label={existing ? "Enregistrer" : "Ajouter la dépense"} variant="primary" block onPress={() => void onSave()} disabled={!valid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
