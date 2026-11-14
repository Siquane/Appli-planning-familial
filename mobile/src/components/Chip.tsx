import { ViewStyle } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { color, radius } from "../theme/tokens";

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  size?: "sm" | "md";
  mono?: boolean;
  squareRadius?: boolean;
  style?: ViewStyle;
  /** Share the row's width equally with the other chips (one line, no wrap); the label shrinks a little if needed. */
  fill?: boolean;
}

// The selectable pill used for day/duration/priority/deadline/category/filter
// choices — selected state is the accent-800 tint, matching every `h.style`/
// `c.style` selection block in the DC templates (chips go square-cornered in
// the "data-grid" direction, radius-md not full pill).
export function Chip({ label, selected, onPress, size = "md", mono, squareRadius = true, style, fill }: Props) {
  return (
    <Pressable
      onPress={onPress}
      // Announced with its state (« sélectionné »); the touch area reaches ~44 px
      // in height without making the pill itself bigger.
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[
        {
          paddingVertical: size === "sm" ? 5 : 7,
          paddingHorizontal: size === "sm" ? 10 : 14,
          borderRadius: squareRadius ? radius.md : 999,
          backgroundColor: selected ? color.accent800 : color.surface,
        },
        fill && { flex: 1, minWidth: 0, paddingHorizontal: 2, alignItems: "center" },
        style,
      ]}
    >
      <Text
        size={size === "sm" ? 11 : 13}
        mono={mono}
        numberOfLines={fill ? 1 : undefined}
        adjustsFontSizeToFit={fill}
        minimumFontScale={0.7}
        style={{ color: selected ? color.accent100 : color.neutral400 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
