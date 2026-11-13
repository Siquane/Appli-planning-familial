import { ActivityIndicator, Pressable, ViewStyle } from "react-native";
import { ReactNode } from "react";
import { Text } from "./Text";
import { color, glow, radius, space } from "../theme/tokens";
import { GradientFill } from "./Brand";

type Variant = "primary" | "secondary" | "ghost" | "icon";

interface Props {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

// Primary actions are filled with the logo's neon gradient (dark text on top);
// secondary and ghost buttons stay sober.
export function Button({ label, onPress, variant = "secondary", block, disabled, loading, icon, style, accessibilityLabel }: Props) {
  const isIcon = variant === "icon";
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: isIcon ? 0 : space[3] * 1.2,
          width: isIcon ? 36 : block ? "100%" : undefined,
          height: isIcon ? 36 : undefined,
          borderRadius: radius.md,
          borderWidth: variant === "ghost" || variant === "primary" ? 0 : 1,
          borderColor: variant === "secondary" || isIcon ? color.divider : "transparent",
          paddingVertical: isIcon ? 0 : variant === "primary" ? space[3] : space[2],
          backgroundColor: pressed && (variant === "secondary" || isIcon) ? "rgba(232,244,255,0.12)" : "transparent",
          boxShadow: variant === "primary" && !disabled ? glow("rgba(76,196,255,0.35)", 14) : undefined,
          opacity: disabled ? 0.45 : pressed && variant === "primary" ? 0.85 : 1,
        },
        style,
      ]}
    >
      {variant === "primary" && <GradientFill radius={radius.md} />}
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? color.bg : color.text} />
      ) : (
        <>
          {icon}
          {label ? (
            <Text weight="medium" heading size={14} style={{ color: variant === "primary" ? color.bg : variant === "ghost" ? color.accent : color.text }}>
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
