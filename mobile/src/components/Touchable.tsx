import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

// The app's Pressable: same API as React Native's, plus what every touchable
// needs and RN doesn't give by default —
//   - a visible reaction while pressed (slightly dimmed),
//   - announced as a button to screen readers (override with accessibilityRole).
// Import it instead of react-native's Pressable.
export function Pressable({ style, accessibilityRole = "button", disabled, ...rest }: PressableProps) {
  return (
    <RNPressable
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      style={(state) => {
        const base = typeof style === "function" ? style(state) : style;
        return [base as StyleProp<ViewStyle>, state.pressed && !disabled ? { opacity: 0.65 } : null];
      }}
      {...rest}
    />
  );
}

/** Extra invisible touch area around a small target (an icon), up to ~44 px. */
export function hitSlopFor(size: number) {
  const extra = Math.max(0, Math.ceil((44 - size) / 2));
  return { top: extra, bottom: extra, left: extra, right: extra };
}
