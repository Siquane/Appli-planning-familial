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
// primary and secondary buttons are « chunky »: a thicker bottom edge that
// flattens under the finger, so the button sinks when pressed.
export function Button({ label, onPress, variant = "secondary", block, disabled, loading, icon, trailing, style, accessibilityLabel, needsNetwork }: Props) {
  const isIcon = variant === "icon";
  // Le bouton principal (dégradé) reste plat : le rebord épais se voyait mal sous le dégradé.
  const chunky = variant === "secondary";
  // A disabled primary button drops the gradient (too murky once faded) for a
  // plain surface with readable grey text, so it still reads clearly.
  const flatPrimary = variant === "primary" && !!disabled && !loading;
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
      style={({ pressed }) => {
        const sunk = pressed && !disabled && !loading;
        return [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          paddingHorizontal: isIcon ? 0 : space.sm * 1.2,
          width: isIcon ? 36 : block ? "100%" : undefined,
          height: isIcon ? 36 : undefined,
          borderRadius: radius.md,
          borderWidth: variant === "ghost" || (variant === "primary" && !flatPrimary) ? 0 : 1,
          borderColor: variant === "secondary" || isIcon || flatPrimary ? color.divider : "transparent",
          paddingVertical: isIcon ? 0 : variant === "primary" ? space.sm + 2 : space.sm,
          backgroundColor: flatPrimary ? color.neutral900 : pressed && (variant === "secondary" || isIcon) ? color.pressed : "transparent",
          boxShadow: variant === "primary" && !disabled ? glow(color.glowSoft, 14) : undefined,
          opacity: disabled && !flatPrimary ? 0.45 : variant === "primary" && sunk ? 0.85 : 1,
          ...(chunky
            ? {
                borderBottomWidth: sunk ? 1 : 4,
                borderBottomColor: color.edgeSoft,
                transform: [{ translateY: sunk ? 3 : 0 }],
              }
            : null),
        },
        style,
      ];
      }}
    >
      {variant === "primary" && !flatPrimary && <GradientFill radius={radius.md} />}
      {loading ? (
        <ActivityIndicator size="small" color={variant === "primary" ? color.onGradient : color.text} />
      ) : (
        <>
          {icon}
          {label ? (
            <Text
              weight="semibold"
              heading
              size={15}
              style={{ color: flatPrimary ? color.neutral400 : variant === "primary" ? color.onGradient : variant === "ghost" ? color.accent : color.text }}
            >
              {label}
            </Text>
          ) : null}
          {trailing}
        </>
      )}
    </Pressable>
  );
}
