import { View } from "react-native";
import { Text } from "./Text";
import { color, radius } from "../theme/tokens";

type Variant = "accent" | "neutral" | "outline";

const variants: Record<Variant, { bg?: string; fg: string; border?: string }> = {
  accent: { bg: color.accent800, fg: color.accent100 },
  neutral: { bg: color.neutral800, fg: color.neutral100 },
  outline: { fg: color.accent, border: color.accent },
};

// `tint` colours the tag from one hue (text, faint fill, soft border) — used
// for task categories, which follow the logo's ring colours.
export function Tag({ label, variant = "outline", tint }: { label: string; variant?: Variant; tint?: string }) {
  const v = tint ? { bg: `${tint}1f`, fg: tint, border: `${tint}59` } : variants[variant];
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: radius.md * 0.75,
        backgroundColor: v.bg,
        borderWidth: v.border ? 1 : 0,
        borderColor: v.border,
      }}
    >
      <Text size={11} style={{ color: v.fg, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}
