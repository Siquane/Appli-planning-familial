import { OfflineBanner } from "./OfflineBanner";
import { useState } from "react";
import { Pressable } from "./Touchable";
import { View } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIcon, MealIcon, WalletIcon, ProfileIcon, PlusIcon } from "./icons";
import { Text } from "./Text";
import { QuickAddSheet } from "./QuickAddSheet";
import { color, glow, space, gutter } from "../theme/tokens";
import { GradientFill } from "./Brand";
import { useIsChildAccount } from "../state/authStore";

// The 4 pillars of Passerelle, two on each side of the « + ».
// Each has its logo colour (cyan → violet); the active one lights up with a
// neon halo and a small glowing ring underneath.
const TABS: Record<string, { label: string; tint: string; Icon: (props: { size: number; color: string }) => React.JSX.Element }> = {
  home: { label: "Planning", get tint() { return color.pillar1; }, Icon: CalendarIcon },
  repas: { label: "Repas", get tint() { return color.pillar2; }, Icon: MealIcon },
  budget: { label: "Budget", get tint() { return color.pillar3; }, Icon: WalletIcon },
  famille: { label: "Famille", get tint() { return color.pillar4; }, Icon: ProfileIcon },
};

type RouteItem = BottomTabBarProps["state"]["routes"][number];

export function CustomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [quickAdd, setQuickAdd] = useState(false);

  // Un compte enfant n'a pas l'onglet Repas : Planning à gauche, Budget et Famille à droite.
  const isChild = useIsChildAccount();
  const routes = state.routes.filter((r: RouteItem) => TABS[r.name] && !(isChild && r.name === "repas"));
  const split = isChild ? 1 : 2;
  const left = routes.slice(0, split);
  const right = routes.slice(split);

  function renderTab(route: RouteItem) {
    const isFocused = state.routes[state.index].key === route.key;
    const { label, Icon, tint: pillar } = TABS[route.name];
    const tint = isFocused ? pillar : color.neutral500;
    return (
      <Pressable
        key={route.key}
        onPress={() => navigateToTab(route.key)}
        style={{ flex: 1, alignItems: "center", gap: space.xs }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        {/* No ring: a larger icon, with a neon halo when active (like the logo's rings). */}
        <View
          style={{
            height: 34,
            justifyContent: "center",
            filter: isFocused ? [{ dropShadow: { offsetX: 0, offsetY: 0, standardDeviation: 5, color: `${pillar}aa` } }] : undefined,
          }}
        >
          <Icon size={28} color={tint} />
        </View>
        <Text size={11} maxFontSizeMultiplier={1.2} numberOfLines={1} style={{ color: tint }}>
          {label}
        </Text>
        {/* A small glowing ring under the active tab, like the logo's rings, so it doesn't rely on colour alone. */}
        <View
          style={{
            width: 8,
            height: 8,
            marginTop: 3,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: isFocused ? pillar : "transparent",
            boxShadow: isFocused ? glow(pillar, 6) : undefined,
          }}
        />
      </Pressable>
    );
  }

  return (
    <View>
      <OfflineBanner />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingBottom: (insets.bottom || 10) + space.md,
          paddingTop: space.md,
          paddingHorizontal: gutter,
          borderTopWidth: 1,
          borderTopColor: color.divider,
          backgroundColor: color.bg,
        }}
      >
        {left.map(renderTab)}

        <Pressable
          onPress={() => setQuickAdd(true)}
          accessibilityLabel="Ajouter"
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            padding: 2,
            marginHorizontal: space.sm,
            marginTop: -24,
            boxShadow: glow(color.glowStrong, 18),
          }}
        >
          <GradientFill radius={26} />
          <View style={{ flex: 1, borderRadius: 24, backgroundColor: color.bg, alignItems: "center", justifyContent: "center" }}>
            <PlusIcon size={22} color={color.pillar2} />
          </View>
        </Pressable>

        {right.map(renderTab)}

        <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
      </View>
    </View>
  );
}
