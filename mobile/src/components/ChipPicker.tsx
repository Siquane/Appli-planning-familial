import { View } from "react-native";
import { Chip } from "./Chip";
import { Text } from "./Text";
import { space } from "../theme/tokens";

interface Props {
  label: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  /** Tapping the selected chip again clears the choice (for optional fields). */
  optional?: boolean;
}

export function ChipPicker({ label, options, selected, onSelect, optional }: Props) {
  return (
    <View style={{ gap: space.sm }}>
      <Text size={13} tone="muted">
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            size="sm"
            selected={selected === o.value}
            onPress={() => onSelect(optional && selected === o.value ? null : o.value)}
          />
        ))}
      </View>
    </View>
  );
}
