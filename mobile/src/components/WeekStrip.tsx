import { View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { color, radius, space } from "../theme/tokens";
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from "../lib/weekdays";
import type { Weekday } from "../api/types";
import { addDays, parseDay } from "../lib/appointments";

// `today` : null quand la semaine affichée n'est pas la semaine en cours.
// `week` (lundi « AAAA-MM-JJ ») : affiche le numéro du jour sous son nom.
export function WeekStrip({ selected, onSelect, today, week }: { selected: Weekday; onSelect: (w: Weekday) => void; today: Weekday | null; week?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      {WEEKDAYS_SHORT.map((label, i) => {
        const w = i as Weekday;
        const isSelected = w === selected;
        return (
          <Pressable
            key={label}
            onPress={() => onSelect(w)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${WEEKDAYS_FULL[w]}${w === today ? ", aujourd'hui" : ""}`}
            style={{
              // All 7 days share the row, whatever the phone's text size.
              flex: 1,
              minWidth: 0,
              paddingVertical: space.md,
              borderRadius: radius.md,
              alignItems: "center",
              gap: space.xs,
              backgroundColor: isSelected ? color.accent800 : color.surface,
            }}
          >
            <Text size={11} weight="medium" numberOfLines={1} adjustsFontSizeToFit style={{ color: isSelected ? color.accent100 : color.neutral500 }}>
              {label}
            </Text>
            {week && (
              <Text size={13} weight="semibold" mono style={{ color: isSelected ? color.accent100 : color.neutral300 }}>
                {parseDay(addDays(week, w)).getDate()}
              </Text>
            )}
            {w === today && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? color.accent100 : color.accent }} />}
          </Pressable>
        );
      })}
    </View>
  );
}
