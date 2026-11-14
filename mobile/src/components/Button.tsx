import { ActivityIndicator, Pressable, ViewStyle } from "react-native";
import { ReactNode } from "react";
import { Text } from "./Text";
import { color, glow, radius, space } from "../theme/tokens";
import { GradientFill } from "./Brand";
import { hitSlopFor } from "./Touchable";
import { useIsOnline } from "../state/networkStore";

type Variant = "primary" | "secondary" | "ghost" | "icon";

interface Props {
  label?: string;
  onPress?: () => void;
  variant?: Variant;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  /** Shown after the label (e.g. the sparkle marking a paid feature). */
  trailing?: ReactNode;
  style?: ViewStyle;
  accessibilityLabel?: string;
  /** The action needs the internet (menus from Claude, statement import, purchases…): disabled while the phone is offline. */
  needsNetwork?: boolean;
}

// Primary actions are filled with the logo's neon gradient (dark text on top);
// secondary and ghost buttons stay sober.
export function Button({ label, onPress, variant = "secondary", block, disabled, loading, icon, trailing, style, accessibilityLabel, needsNetwork }: Props) {
  const isIcon = variant === "icon";
  const online = useIsOnline();
  if (needsNetwork && !online) disabled = true;
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={isIcon ? hitSlopFor(36) : undefined}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          paddingHorizontal: isIcon ? 0 : space.sm * 1.2,
          width: isIcon ? 36 : block ? "100%" : undefined,
          height: isIcon ? 36 : undefined,
          borderRadius: radius.md,
          borderWidth: variant === "ghost" || variant === "primary" ? 0 : 1,
          borderColor: variant === "secondary" || isIcon ? color.divider : "transparent",
          paddingVertical: isIcon ? 0 : variant === "primary" ? space.sm : space.sm,
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
            <Text weight="medium" heading size={15} style={{ color: variant === "primary" ? color.bg : variant === "ghost" ? color.accent : color.text }}>
              {label}
            </Text>
          ) : null}
          {trailing}
        </>
      )}
    </Pressable>
  );
}
