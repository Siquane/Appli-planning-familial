import { View } from "react-native";
import { Text } from "./Text";
import { color, radius, space } from "../theme/tokens";

type Variant = "accent" | "neutral" | "outline";

const variants: Record<Variant, { bg?: string; fg: string; border?: string }> = {
  accent: { get bg() { return color.accent800; }, get fg() { return color.accent100; } },
  neutral: { get bg() { return color.neutral800; }, get fg() { return color.neutral100; } },
  outline: { get fg() { return color.accent; }, get border() { return color.accent; } },
};

// `tint` colours the tag from one hue (text, faint fill, soft border) — used
// for task categories, which follow the logo's ring colours.
export function Tag({ label, variant = "outline", tint }: { label: string; variant?: Variant; tint?: string }) {
  const v = tint ? { bg: `${tint}1f`, fg: tint, border: `${tint}59` } : variants[variant];
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: space.md,
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
