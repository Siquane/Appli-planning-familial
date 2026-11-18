import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { KeyboardScrollView } from "../components/KeyboardScrollView";
import { Screen } from "../components/Screen";
import { Text } from "../components/Text";
import { TextField } from "../components/TextField";
import { TimeField } from "../components/TimeField";
import { DateField } from "../components/DateField";
import { Chip } from "../components/Chip";
import { Button } from "../components/Button";
import { TopBar } from "../components/TopBar";
import { useCreateTask, useMembers, useUpdateTask } from "../hooks/useApi";
import { useToastStore } from "../state/toastStore";
import { confirmReminderPermission } from "../lib/notifications";
import { appointmentDayLabel, dayKey, parseDay, weekdayOfDay } from "../lib/appointments";
import { errorText } from "../lib/errors";
import { goBack } from "../lib/navigation";
import { space, gutter } from "../theme/tokens";
import type { Category, Task } from "../api/types";

const CATEGORIES: Category[] = ["École", "Travail", "Maison", "Santé", "Loisirs"];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const REMINDERS: { key: Task["remind"]; label: string }[] = [
  { key: null, label: "Aucun" },
  { key: "hour", label: "1 h avant" },
  { key: "eve", label: "La veille" },
];

const durationLabel = (d: number) => (d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)}h${d % 60}` : `${d / 60}h`);

interface Props {
  /** Rendez-vous modifié, ou recopié (« Dupliquer »). */
  existing?: Task;
  source?: Task;
  prefillTitle?: string;
  prefillMember?: string;
  /** Choix Tâche / Rendez-vous, affiché en haut à la création. */
  kindSwitch?: ReactNode;
}

// Rendez-vous : une date précise (il n'apparaît que dans sa semaine), une
// heure, un lieu et un rappel au choix. Pas de priorité ni de « flexible ».
export function AppointmentForm({ existing, source, prefillTitle, prefillMember, kindSwitch }: Props) {
  const { data: members = [] } = useMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [title, setTitle] = useState(prefillTitle ?? "");
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<Category>("Santé");
  const [memberIds, setMemberIds] = useState<string[]>(prefillMember ? [prefillMember] : []);
  const [remind, setRemind] = useState<Task["remind"]>(null);
  const [notes, setNotes] = useState("");

  // Rempli une seule fois : un rafraîchissement ne doit pas effacer la saisie.
  const loaded = useRef(false);
  const from = existing ?? source;
  useEffect(() => {
    if (!from || loaded.current) return;
    loaded.current = true;
    setTitle(from.title);
    setDate(from.appointmentDate ? parseDay(from.appointmentDate) : null);
    setTime(from.time);
    setDuration(from.duration);
    setLocation(from.location ?? "");
    setCategory(from.category);
    setMemberIds(from.memberIds);
    setRemind(from.remind ?? null);
    setNotes(from.notes);
  }, [from]);

  const missing: string[] = [];
  if (!title.trim()) missing.push("un titre");
  if (!date) missing.push("une date");
  if (!/^\d{2}:\d{2}$/.test(time)) missing.push("une heure");
  const isValid = missing.length === 0;
  const saving = createTask.isPending || updateTask.isPending;

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSave() {
    if (!isValid || !date) return;
    const day = dayKey(date);
    const data = {
      title: title.trim(),
      category,
      weekday: weekdayOfDay(day),
      time,
      duration,
      appointmentDate: day,
      location: location.trim(),
      remind,
      memberIds,
      notes,
      recurring: false,
      flexible: false,
    };
    try {
      if (existing) await updateTask.mutateAsync({ id: existing.id, data });
      else await createTask.mutateAsync(data);
      useToastStore.getState().show(`${existing ? "Rendez-vous modifié" : "Rendez-vous ajouté"} : ${appointmentDayLabel(day)} à ${time}.`);
      goBack();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer le rendez-vous"));
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar
        title={existing ? "Modifier le rendez-vous" : source ? "Dupliquer le rendez-vous" : "Nouveau rendez-vous"}
        onBack={() => goBack()}
        save={{ onPress: onSave, disabled: !isValid, loading: saving }}
      />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        {kindSwitch}

        <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Dentiste de Jules" />

        <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            <DateField label="Date" value={date} onChange={setDate} future />
          </View>
          <View style={{ flex: 1 }}>
            <TimeField label="Heure" value={time} onChange={setTime} />
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Durée
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {DURATIONS.map((d) => (
              <Chip key={d} label={durationLabel(d)} selected={duration === d} onPress={() => setDuration(d)} size="sm" mono />
            ))}
          </View>
        </View>

        <TextField label="Lieu (facultatif)" value={location} onChangeText={setLocation} placeholder="Ex. Cabinet du Dr Martin" maxLength={200} />

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Catégorie
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} size="sm" fill />
            ))}
          </View>
        </View>

        {members.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text size={13} tone="muted">
              Pour qui ?
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {members.map((m) => (
                <Chip key={m.id} label={m.name} selected={memberIds.includes(m.id)} onPress={() => toggleMember(m.id)} size="sm" />
              ))}
            </View>
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Rappel
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {REMINDERS.map((r) => (
              <Chip
                key={r.label}
                label={r.label}
                selected={remind === r.key}
                onPress={() => {
                  setRemind(r.key);
                  if (r.key) confirmReminderPermission();
                }}
                size="sm"
                fill
              />
            ))}
          </View>
          <Text size={11} tone="faint">
            {remind === "eve" ? "Une notification la veille à 20 h." : remind === "hour" ? "Une notification une heure avant." : "Il apparaît aussi dans le récap du matin du jour J, s'il est activé."}
          </Text>
        </View>

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Papiers à apporter, code de la porte…" />

        {!isValid && (
          <Text tone="muted" size={13} center>
            Pour {existing ? "enregistrer" : "ajouter le rendez-vous"}, il manque : {missing.join(", ")}.
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Ajouter le rendez-vous"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
