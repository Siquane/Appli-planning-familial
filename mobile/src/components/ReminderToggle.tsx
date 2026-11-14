import { Switch, View } from "react-native";
import { Pressable } from "./Touchable";
import { Card } from "./Card";
import { Text } from "./Text";
import { BellIcon } from "./icons";
import { color, space } from "../theme/tokens";

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
}

// A full-width row rather than a chip, so the reminder doesn't read as one
// more category: bell, label + hint, and an on/off switch. The whole row is
// tappable, and the border lights up in accent when the reminder is on.
export function ReminderToggle({ value, onChange }: Props) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel="Rappel">
      <Card row style={{ alignItems: "center", borderWidth: 1, borderColor: value ? color.accent600 : color.divider }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value ? color.accent800 : color.neutral900,
          }}
        >
          <BellIcon size={18} color={value ? color.accent200 : color.neutral400} />
        </View>
        <View style={{ flex: 1, marginLeft: space[2] }}>
          <Text size={14} weight="medium">
            Rappel
          </Text>
          <Text size={11.5} tone={value ? "accent" : "faint"}>
            {value ? "Activé : une notification avant la tâche" : "Recevoir une notification avant la tâche"}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: color.neutral700, true: color.accent700 }}
          thumbColor={value ? color.accent300 : color.neutral300}
          ios_backgroundColor={color.neutral700}
        />
      </Card>
    </Pressable>
  );
}
