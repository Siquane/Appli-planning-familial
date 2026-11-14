import { View } from "react-native";
import { Text } from "./Text";
import { ChevronRightIcon } from "./icons";
import { color } from "../theme/tokens";

// « Voir Budget+ › » with the drawn arrow instead of the « › » character.
// Meant to sit inside a Pressable that handles the tap.
export function MoreLink({ label, size = 12, center }: { label: string; size?: number; center?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, alignSelf: center ? "center" : "flex-start" }}>
      <Text size={size} weight="medium" style={{ color: color.accent400 }}>
        {label}
      </Text>
      <ChevronRightIcon size={size + 2} color={color.accent400} />
    </View>
  );
}
