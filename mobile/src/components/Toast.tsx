import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { color, radius, space } from "../theme/tokens";
import { useToastStore, type ToastIcon } from "../state/toastStore";
import { PartyIcon, SparkleIcon, WarningIcon } from "./icons";

const ICONS: Record<ToastIcon, { Icon: typeof PartyIcon; tint: string }> = {
  party: { Icon: PartyIcon, tint: color.accent400 },
  sparkle: { Icon: SparkleIcon, tint: color.accent400 },
  warning: { Icon: WarningIcon, tint: color.danger },
};

// Global toast overlay, mounted once in the root layout. Any screen triggers
// it via useToastStore.getState().show(message) — used for calendar-sync
// results, save confirmations, etc. instead of native Alert, to match the
// DC prototype's inline banner pattern.
export function Toast() {
  const message = useToastStore((s) => s.message);
  const icon = useToastStore((s) => s.icon);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => hide());
    }, 2600);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, { top: insets.top + 10, opacity }]} pointerEvents="none">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2] }}>
        {icon && (() => {
          const { Icon, tint } = ICONS[icon];
          return <Icon size={18} color={tint} />;
        })()}
        <Text weight="medium" size={13} center style={{ flexShrink: 1 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: space[4],
    right: space[4],
    backgroundColor: color.neutral900,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 100,
  },
});
