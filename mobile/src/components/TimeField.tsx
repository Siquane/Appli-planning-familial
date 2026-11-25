import { useState } from "react";
import { Pressable } from "./Touchable";
import { Modal, Platform, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Text } from "./Text";
import { Button } from "./Button";
import { color, radius, space } from "../theme/tokens";

function parseTime(time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface Props {
  /** Omit to render the field alone (e.g. inside a row that already names it). */
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

// Android shows its native clock-face dialog directly; iOS has no clock
// face, so the spinner wheel is wrapped in a bottom-sheet-style modal with
// an explicit confirm button (spinner doesn't dismiss on its own there).
export function TimeField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseTime(value));

  function openPicker() {
    setDraft(parseTime(value));
    setOpen(true);
  }

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === "android") {
      setOpen(false);
      if (selected) onChange(formatTime(selected));
      return;
    }
    if (selected) setDraft(selected);
  }

  function confirmIOS() {
    onChange(formatTime(draft));
    setOpen(false);
  }

  return (
    <View style={{ gap: space.sm }}>
      {label ? (
        <Text size={13} tone="muted">
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} : ${value}` : value}
        style={{
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: color.divider,
          alignSelf: "flex-start",
          minWidth: 96,
        }}
      >
        <Text mono size={15}>
          {value}
        </Text>
      </Pressable>

      {open && Platform.OS === "android" && (
        <DateTimePicker value={draft} mode="time" display="clock" is24Hour onChange={handleChange} />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setOpen(false)} accessibilityLabel="Fermer">
            <Pressable
              accessible={false}
              style={{ backgroundColor: color.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.md }}
              onPress={(e) => e.stopPropagation()}
            >
              <DateTimePicker value={draft} mode="time" display="spinner" is24Hour onChange={handleChange} textColor={color.text} />
              <Button label="Valider" variant="primary" block onPress={confirmIOS} style={{ marginTop: space.sm }} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
