import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { color, radius } from "../theme/tokens";
import { WEEKDAYS_SHORT } from "../lib/weekdays";
import type { Weekday } from "../api/types";

export function WeekStrip({ selected, onSelect, today }: { selected: Weekday; onSelect: (w: Weekday) => void; today: Weekday }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {WEEKDAYS_SHORT.map((label, i) => {
        const w = i as Weekday;
        const isSelected = w === selected;
        return (
          <Pressable
            key={label}
            onPress={() => onSelect(w)}
            style={{
              // All 7 days share the row, whatever the phone's text size.
              flex: 1,
              minWidth: 0,
              paddingVertical: 12,
              borderRadius: radius.md,
              alignItems: "center",
              gap: 4,
              backgroundColor: isSelected ? color.accent800 : color.surface,
            }}
          >
            <Text size={11} weight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ color: isSelected ? color.accent100 : color.neutral500 }}>
              {label}
            </Text>
            {w === today && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? color.accent100 : color.accent }} />}
          </Pressable>
        );
      })}
    </View>
  );
}
