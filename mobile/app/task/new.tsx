import { useEffect, useMemo, useRef, useState } from "react";
import { Switch, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable } from "../../src/components/Touchable";
import { KeyboardScrollView } from "../../src/components/KeyboardScrollView";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { ScheduleTimes } from "../../src/components/ScheduleTimes";
import { allTimesValid, resolveTimes, type DayTimes } from "../../src/lib/dayTimes";
import { newSeriesId, planSeriesEdit, seriesOf, seriesSchedule } from "../../src/lib/taskSeries";
import { isChild, starsLabel } from "../../src/lib/stars";
import { StarIcon } from "../../src/components/icons";
import { Chip } from "../../src/components/Chip";
import { ReminderToggle } from "../../src/components/ReminderToggle";
import { Button } from "../../src/components/Button";
import { TopBar } from "../../src/components/TopBar";
import { useAutoSlotTask, useCreateTask, useDeleteTask, useMembers, useTasks, useUpdateTask } from "../../src/hooks/useApi";
import { useToastStore } from "../../src/state/toastStore";
import { confirmReminderPermission } from "../../src/lib/notifications";
import { color, space, gutter } from "../../src/theme/tokens";
import { WEEKDAYS_SHORT } from "../../src/lib/weekdays";
import { parseDuration, splitDuration } from "../../src/lib/duration";
import type { Category, Priority, Task, Weekday } from "../../src/api/types";
import { errorText } from "../../src/lib/errors";
import { goBack, useBackFallback } from "../../src/lib/navigation";
import { AppointmentForm } from "../../src/screens/AppointmentForm";

const CATEGORIES: Category[] = ["École", "Travail", "Maison", "Santé", "Loisirs"];
const DURATIONS = [15, 30, 45, 60, 90, 120];
const PRIORITIES: { key: Priority; label: string }[] = [
  { key: "low", label: "Basse" },
  { key: "medium", label: "Moyenne" },
  { key: "high", label: "Haute" },
];

export default function TaskFormScreen() {
  const { edit, duplicate, title: prefillTitle, category: prefillCategory, recurring: prefillRecurring, duration: prefillDuration, member: prefillMember, kind: prefillKind } =
    useLocalSearchParams<{ edit?: string; duplicate?: string; title?: string; category?: string; recurring?: string; duration?: string; member?: string; kind?: string }>();
  // Tâche de la semaine type, ou rendez-vous à une date précise.
  const [kind, setKind] = useState<"task" | "appointment">(prefillKind === "appointment" ? "appointment" : "task");
  const { data: tasks = [] } = useTasks();
  const { data: members = [] } = useMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const autoSlotTask = useAutoSlotTask();
  useBackFallback();

  const existing: Task | undefined = useMemo(() => tasks.find((t) => t.id === edit), [tasks, edit]);
  // En modification, on travaille sur toute la série (tous les jours créés ensemble).
  const siblings: Task[] = useMemo(() => (existing ? seriesOf(tasks, existing) : []), [tasks, existing]);

  const [title, setTitle] = useState(prefillTitle ?? "");
  const [category, setCategory] = useState<Category>((prefillCategory as Category) ?? "Maison");
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [time, setTime] = useState("08:00");
  const [perDayTimes, setPerDayTimes] = useState(false);
  const [dayTimes, setDayTimes] = useState<DayTimes>({});
  const [duration, setDuration] = useState(prefillDuration ? Number(prefillDuration) : 30);
  // « Autre » : durée libre en heures + minutes.
  const [customDuration, setCustomDuration] = useState(prefillDuration ? !DURATIONS.includes(Number(prefillDuration)) : false);
  const [customFields, setCustomFields] = useState(() => splitDuration(prefillDuration ? Number(prefillDuration) : 30));

  function applyDuration(d: number) {
    setDuration(d);
    if (!DURATIONS.includes(d)) {
      setCustomDuration(true);
      setCustomFields(splitDuration(d));
    } else {
      setCustomDuration(false);
    }
  }

  function setCustomField(field: "hours" | "minutes", value: string) {
    const next = { ...customFields, [field]: value.replace(/[^0-9]/g, "") };
    setCustomFields(next);
    const parsed = parseDuration(next.hours, next.minutes);
    if (parsed !== null) setDuration(parsed);
  }
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadlineWeekday, setDeadlineWeekday] = useState<Weekday | null>(null);
  const [recurring, setRecurring] = useState(prefillRecurring === "1");
  const [reminder, setReminder] = useState(false);
  const [flexible, setFlexible] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>(prefillMember ? [prefillMember] : []);
  const [notes, setNotes] = useState("");
  const [stars, setStars] = useState(1);
  const [inDigest, setInDigest] = useState(true);

  // Rempli une seule fois : un rafraîchissement de la liste (toutes les
  // minutes avec la famille partagée) ne doit pas écraser la saisie.
  const loaded = useRef(false);
  useEffect(() => {
    if (!existing || loaded.current) return;
    loaded.current = true;
    const schedule = seriesSchedule(seriesOf(tasks, existing));
    setTitle(existing.title);
    setCategory(existing.category);
    setWeekdays(schedule.weekdays);
    setTime(existing.time);
    setDayTimes(schedule.dayTimes);
    setPerDayTimes(schedule.perDay);
    applyDuration(existing.duration);
    setPriority(existing.priority);
    setDeadlineWeekday(existing.deadlineWeekday);
    setRecurring(existing.recurring);
    setReminder(existing.reminder);
    setFlexible(existing.flexible);
    setMemberIds(existing.memberIds);
    setNotes(existing.notes);
    setStars(existing.stars ?? 1);
    setInDigest(existing.inDigest ?? true);
  }, [existing]);

  // « Dupliquer » : on recopie la tâche source dans un formulaire de
  // création (une seule fois, pour ne pas écraser ce que l'utilisateur
  // modifie si la liste des tâches se rafraîchit).
  const source: Task | undefined = useMemo(() => (duplicate ? tasks.find((t) => t.id === duplicate) : undefined), [tasks, duplicate]);
  const prefilled = useRef(false);
  useEffect(() => {
    if (!source || prefilled.current) return;
    prefilled.current = true;
    const schedule = seriesSchedule(seriesOf(tasks, source));
    setTitle(source.title);
    setCategory(source.category);
    setWeekdays(schedule.weekdays);
    setTime(source.time);
    setDayTimes(schedule.dayTimes);
    setPerDayTimes(schedule.perDay);
    applyDuration(source.duration);
    setPriority(source.priority);
    setDeadlineWeekday(source.deadlineWeekday);
    setRecurring(source.recurring);
    setReminder(source.reminder);
    setFlexible(source.flexible);
    setMemberIds(source.memberIds);
    setNotes(source.notes);
    setStars(source.stars ?? 1);
    setInDigest(source.inDigest ?? true);
  }, [source]);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Plusieurs jours possibles (ex. lundi + mercredi) : une tâche par jour,
  // reliées en série. En modification, il faut garder au moins un jour.
  function toggleWeekday(w: Weekday) {
    setWeekdays((prev) => {
      if (!prev.includes(w)) return [...prev, w];
      return existing && prev.length === 1 ? prev : prev.filter((x) => x !== w);
    });
  }

  // Aucun jour coché en création = on laisse Passerelle choisir le créneau
  // (priorité, échéance, charge de la semaine...), donc l'heure saisie
  // manuellement ne s'applique qu'au placement manuel.
  const autoPlacement = !existing && weekdays.length === 0;

  const missing: string[] = [];
  if (!title.trim()) missing.push("un titre");
  // Création sur plusieurs jours : une heure par jour si l'interrupteur est activé.
  const times = resolveTimes(weekdays, time, perDayTimes, dayTimes);
  if (customDuration && parseDuration(customFields.hours, customFields.minutes) === null) missing.push("une durée entre 5 min et 8 h");
  if (!autoPlacement && !allTimesValid(times)) missing.push("une heure valide (HH:MM)");
  const isValid = missing.length === 0;
  const [savingSeries, setSavingSeries] = useState(false);
  const saving = savingSeries || createTask.isPending || updateTask.isPending || autoSlotTask.isPending;

  async function onSave() {
    const base = { title: title.trim(), category, duration, priority, deadlineWeekday, recurring, reminder, memberIds, notes, stars, inDigest };
    try {
      if (existing) {
        setSavingSeries(true);
        const plan = planSeriesEdit(siblings, weekdays, times);
        const several = plan.updates.length + plan.creates.length > 1;
        const seriesId = existing.seriesId ?? (several ? newSeriesId() : null);
        for (const u of plan.updates) {
          await updateTask.mutateAsync({ id: u.id, data: { ...base, flexible, seriesId, weekday: u.weekday, ...(u.time ? { time: u.time } : {}) } });
        }
        for (const c of plan.creates) {
          await createTask.mutateAsync({ ...base, flexible, seriesId, weekday: c.weekday, time: c.time });
        }
        for (const id of plan.deletes) await deleteTask.mutateAsync(id);
        useToastStore.getState().show(several ? "Tâches modifiées." : "Tâche modifiée.");
        // Le jour ouvert a été décoché : sa fiche n'existe plus, on revient à la liste.
        if (plan.deletes.includes(existing.id)) {
          router.dismiss(2);
          return;
        }
      } else if (autoPlacement) {
        const slot = await autoSlotTask.mutateAsync({ priority, deadlineWeekday, memberIds });
        await createTask.mutateAsync({ ...base, time: slot.time, weekday: slot.weekday, flexible: true });
        useToastStore.getState().show(`Tâche créée automatiquement — ${WEEKDAYS_SHORT[slot.weekday]} à ${slot.time}.`);
      } else {
        const seriesId = weekdays.length > 1 ? newSeriesId() : null;
        for (const weekday of weekdays) {
          await createTask.mutateAsync({ ...base, time: times[weekday] ?? time, weekday, flexible, seriesId });
        }
        useToastStore.getState().show(weekdays.length > 1 ? "Tâches créées." : "Tâche créée.");
      }
      goBack();
    } catch (e) {
      useToastStore.getState().show(errorText(e, "enregistrer la tâche"));
    } finally {
      setSavingSeries(false);
    }
  }

  const kindSwitch =
    !existing && !source ? (
      <View style={{ flexDirection: "row", gap: space.xs }}>
        <Chip label="Tâche" selected={kind === "task"} onPress={() => setKind("task")} fill />
        <Chip label="Rendez-vous" selected={kind === "appointment"} onPress={() => setKind("appointment")} fill />
      </View>
    ) : null;

  const appointmentForm = existing ? !!existing.appointmentDate : source ? !!source.appointmentDate : kind === "appointment";
  if (appointmentForm) {
    return <AppointmentForm existing={existing} source={source} prefillTitle={title} prefillMember={memberIds[0]} kindSwitch={kindSwitch} />;
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title={existing ? "Modifier la tâche" : source ? "Dupliquer la tâche" : "Nouvelle tâche"} onBack={() => goBack()} save={{ onPress: onSave, disabled: !isValid, loading: saving }} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.section }} showsVerticalScrollIndicator={false}>
        {kindSwitch}

        <TextField label="Titre" value={title} onChangeText={setTitle} placeholder="Ex. Devoirs de Léo" />

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

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Jour{existing ? "s (plusieurs possibles)" : " (plusieurs possibles, ou aucun)"}
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {WEEKDAYS_SHORT.map((label, i) => (
              <Chip key={label} label={label} selected={weekdays.includes(i as Weekday)} onPress={() => toggleWeekday(i as Weekday)} size="sm" fill />
            ))}
          </View>
          {existing && siblings.length > 1 && (
            <Text tone="faint" size={13}>
              Les changements s'appliquent aux {siblings.length} jours de cette tâche. Décocher un jour le retire du planning.
            </Text>
          )}
          {autoPlacement && (
            <Text tone="faint" size={13}>
              Aucun jour choisi : Passerelle trouvera le meilleur créneau de la semaine selon la priorité, l'échéance et ce qui est déjà prévu.
            </Text>
          )}
        </View>

        {!autoPlacement && (
          <ScheduleTimes
            weekdays={weekdays}
            time={time}
            onTimeChange={setTime}
            perDay={perDayTimes}
            onPerDayChange={setPerDayTimes}
            dayTimes={dayTimes}
            onDayTimesChange={setDayTimes}
          />
        )}

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Durée
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {DURATIONS.map((d) => (
              <Chip
                key={d}
                label={d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)}h${d % 60}` : `${d / 60}h`}
                selected={!customDuration && duration === d}
                onPress={() => applyDuration(d)}
                size="sm"
                mono
              />
            ))}
            <Chip
              label="Autre"
              selected={customDuration}
              onPress={() => {
                setCustomDuration(true);
                setCustomFields(splitDuration(duration));
              }}
              size="sm"
            />
          </View>
          {customDuration && (
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Heures" value={customFields.hours} onChangeText={(v) => setCustomField("hours", v)} keyboardType="number-pad" maxLength={1} placeholder="0" />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Minutes" value={customFields.minutes} onChangeText={(v) => setCustomField("minutes", v)} keyboardType="number-pad" maxLength={2} placeholder="0" />
              </View>
            </View>
          )}
          {customDuration && parseDuration(customFields.hours, customFields.minutes) === null && (
            <Text size={12} tone="danger" accessibilityLiveRegion="polite">
              Entre 5 min et 8 h, minutes de 0 à 59.
            </Text>
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Priorité
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            {PRIORITIES.map((p) => (
              <Chip key={p.key} label={p.label} selected={priority === p.key} onPress={() => setPriority(p.key)} size="sm" fill />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Text size={13} tone="muted">
            Échéance (facultatif)
          </Text>
          <View style={{ flexDirection: "row", gap: space.xs }}>
            <Chip label="Aucune" selected={deadlineWeekday === null} onPress={() => setDeadlineWeekday(null)} size="sm" fill />
            {WEEKDAYS_SHORT.map((label, i) => (
              <Chip key={label} label={label} selected={deadlineWeekday === i} onPress={() => setDeadlineWeekday(i as Weekday)} size="sm" fill />
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

        {members.some((m) => memberIds.includes(m.id) && isChild(m)) && (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <StarIcon size={14} color={color.pillar3} />
              <Text size={13} tone="muted">
                Étoiles gagnées quand c'est fait : {stars === 0 ? "aucune" : starsLabel(stars)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: space.xs }}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} label={n === 0 ? "Aucune" : `${n} ★`} selected={stars === n} onPress={() => setStars(n)} size="sm" fill />
              ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label="Récurrente" selected={recurring} onPress={() => setRecurring((v) => !v)} size="sm" />
          {!autoPlacement && (
            <Chip label="Flexible (Passerelle peut la déplacer)" selected={flexible} onPress={() => setFlexible((v) => !v)} size="sm" />
          )}
        </View>

        {recurring && (
          <ReminderToggle
            value={reminder}
            onChange={(next) => {
              setReminder(next);
              if (next) confirmReminderPermission();
            }}
          />
        )}

        <Pressable
          onPress={() => setInDigest((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: inDigest }}
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <View style={{ flex: 1 }}>
            <Text size={15}>Dans les récaps</Text>
            <Text size={12} tone="faint">
              Récap du soir (tâches du lendemain) et du matin (tâches du jour). Décoche pour une tâche évidente, comme le coucher.
            </Text>
          </View>
          <Switch
            value={inDigest}
            onValueChange={setInDigest}
            trackColor={{ false: color.neutral700, true: color.accent700 }}
            thumbColor={inDigest ? color.accent300 : color.neutral300}
          />
        </Pressable>

        <TextField label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Détails, lieu, contexte..." />

        {!isValid && (
          <Text tone="muted" size={13} center>
            Pour {existing ? "enregistrer" : "créer la tâche"}, il manque : {missing.join(", ")}.
          </Text>
        )}

        <Button label={existing ? "Enregistrer" : "Créer la tâche"} variant="primary" block onPress={onSave} disabled={!isValid} loading={saving} />
      </KeyboardScrollView>
    </Screen>
  );
}
