import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Vibration, View } from "react-native";
import { motionReduced } from "./motion";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { color, radius, space } from "../theme/tokens";
import { WEEKDAYS_FULL, WEEKDAYS_SHORT } from "../lib/weekdays";
import type { Weekday } from "../api/types";
import { addDays, parseDay } from "../lib/appointments";

// `today` : null quand la semaine affichée n'est pas la semaine en cours.
// `week` (lundi « AAAA-MM-JJ ») : affiche le numéro du jour sous son nom.
export function WeekStrip({ selected, onSelect, today, week }: { selected: Weekday; onSelect: (w: Weekday) => void; today: Weekday | null; week?: string }) {
  // La pastille du jour choisi glisse d'un jour à l'autre.
  const [width, setWidth] = useState(0);
  const pos = useRef(new Animated.Value(selected)).current;
  useEffect(() => {
    if (motionReduced()) pos.setValue(selected);
    else Animated.spring(pos, { toValue: selected, useNativeDriver: false, speed: 16, bounciness: 6 }).start();
  }, [selected]);
  const GAP = space.sm;
  const itemW = width ? (width - GAP * 6) / 7 : 0;
  return (
    <View style={{ flexDirection: "row", gap: space.sm }} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {itemW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, bottom: 0, width: itemW, borderRadius: radius.md, backgroundColor: color.accent800, left: pos.interpolate({ inputRange: [0, 6], outputRange: [0, 6 * (itemW + GAP)] }) }}
        />
      ) : null}
      {WEEKDAYS_SHORT.map((label, i) => {
        const w = i as Weekday;
        const isSelected = w === selected;
        return (
          <Pressable
            key={label}
            onPress={() => {
              if (w === selected) return;
              if (Platform.OS === "android" && !motionReduced()) Vibration.vibrate(8);
              onSelect(w);
            }}
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
              // Le jour choisi est la pastille qui glisse (dessinée derrière).
              backgroundColor: isSelected ? (itemW > 0 ? "transparent" : color.accent800) : color.surface,
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
