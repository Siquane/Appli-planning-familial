import { View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { weekRange, weekTitle } from "../lib/appointments";
import { color, space } from "../theme/tokens";

/** « ‹ Cette semaine · 23 – 29 nov. › » : pour passer d'une semaine à l'autre. */
export function WeekNav({ week, current, onPrev, onNext }: { week: string; current: string; onPrev: () => void; onNext: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel="Semaine précédente" hitSlop={10} style={{ padding: space.xs }}>
        <ChevronLeftIcon size={18} color={color.neutral400} />
      </Pressable>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text weight="medium" size={15}>
          {weekTitle(week, current)}
        </Text>
        <Text size={11} tone="faint">
          {weekRange(week)}
        </Text>
      </View>
      <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="Semaine suivante" hitSlop={10} style={{ padding: space.xs }}>
        <ChevronRightIcon size={18} color={color.neutral400} />
      </Pressable>
    </View>
  );
}
