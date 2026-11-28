import { View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { color, space } from "../theme/tokens";

// Sous-onglets d'un onglet (Menu / Recettes / Courses, Mon budget / Partagés) :
// une pilule par choix, celle choisie prend la couleur de l'onglet.
// `badge` : petit compteur (articles à acheter…).
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  tint,
}: {
  items: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
  tint: string;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: color.surface, borderWidth: 1, borderColor: color.neutral800 }}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.badge ? `${it.label}, ${it.badge}` : it.label}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: on ? tint + "38" : "transparent",
              borderWidth: 1,
              borderColor: on ? tint + "99" : "transparent",
            }}
          >
            <Text size={13} weight={on ? "semibold" : "regular"} numberOfLines={1} style={{ color: on ? color.text : color.neutral400, flexShrink: 1 }}>
              {it.label}
            </Text>
            {it.badge ? (
              <View style={{ minWidth: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: tint + "33", alignItems: "center" }}>
                <Text size={10} weight="semibold" style={{ color: tint }}>
                  {it.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
