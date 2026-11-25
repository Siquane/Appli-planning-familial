import { useState } from "react";
import { Pressable } from "./Touchable";
import { Modal, Platform, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Text } from "./Text";
import { Button } from "./Button";
import { color, radius, space } from "../theme/tokens";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface Props {
  label: string;
  value: Date | null;
  onChange: (value: Date) => void;
  placeholder?: string;
  /** Dates à venir permises (rendez-vous, échéance). Par défaut : jusqu'à aujourd'hui (naissance, dépense). */
  future?: boolean;
}

// Same pattern as TimeField: Android's native dialog dismisses itself,
// iOS's spinner is wrapped in a bottom-sheet modal with an explicit confirm.
export function DateField({ label, value, onChange, placeholder = "Choisir une date", future = false }: Props) {
  const maximumDate = future ? undefined : new Date();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => value ?? new Date());

  function openPicker() {
    setDraft(value ?? new Date());
    setOpen(true);
  }

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (selected) onChange(selected);
      return;
    }
    if (selected) setDraft(selected);
  }

  function confirmIOS() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <Pressable
        onPress={openPicker}
        accessibilityLabel={`${label} : ${value ? formatDate(value) : "à choisir"}`}
        style={{
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: color.divider,
          alignSelf: "flex-start",
          minWidth: 140,
        }}
      >
        <Text size={15} tone={value ? undefined : "muted"}>
          {value ? formatDate(value) : placeholder}
        </Text>
      </Pressable>

      {open && Platform.OS === "android" && (
        <DateTimePicker value={draft} mode="date" display="calendar" maximumDate={maximumDate} onChange={handleChange} />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setOpen(false)} accessibilityLabel="Fermer">
            <Pressable
              accessible={false}
              style={{ backgroundColor: color.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.md }}
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker value={draft} mode="date" display="spinner" maximumDate={maximumDate} onChange={handleChange} textColor={color.text} />
              <Button label="Valider" variant="primary" block onPress={confirmIOS} style={{ marginTop: space.sm }} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
