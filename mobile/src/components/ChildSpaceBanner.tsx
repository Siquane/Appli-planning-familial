import { View } from "react-native";
import { Pressable } from "./Touchable";
import { Text } from "./Text";
import { useChildSpaceStore } from "../state/childSpaceStore";
import { exitChildSpace } from "../lib/childSpace";
import { color, radius, space } from "../theme/tokens";

// Rappelle qu'on regarde le budget ou les documents d'un enfant, avec le retour.
export function ChildSpaceBanner() {
  const name = useChildSpaceStore((s) => s.name);
  if (!name) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        padding: space.md,
        borderRadius: radius.md,
        backgroundColor: color.accent900,
        borderWidth: 1,
        borderColor: color.accent700,
      }}
    >
      <Text size={13} weight="medium" style={{ flex: 1 }}>
        Espace de {name}
      </Text>
      <Pressable onPress={exitChildSpace} accessibilityRole="button" hitSlop={8}>
        <Text size={13} tone="accent" weight="medium">
          Revenir à mon espace
        </Text>
      </Pressable>
    </View>
  );
}
