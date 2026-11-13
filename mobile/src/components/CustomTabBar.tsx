import { useState } from "react";
import { View, Pressable } from "react-native";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIcon, MealIcon, WalletIcon, ProfileIcon, PlusIcon } from "./icons";
import { Text } from "./Text";
import { QuickAddSheet } from "./QuickAddSheet";
import { color, glow, space } from "../theme/tokens";
import { GradientFill } from "./Brand";

// The 4 pillars of Passerelle, two on each side of the « + ».
// Each is one of the logo's rings (cyan → violet) around the tab's icon; the
// active ring lights up with a neon halo, like on the logo.
const TABS: Record<string, { label: string; tint: string; Icon: (props: { size: number; color: string }) => React.JSX.Element }> = {
  home: { label: "Planning", tint: color.pillar1, Icon: CalendarIcon },
  repas: { label: "Repas", tint: color.pillar2, Icon: MealIcon },
  budget: { label: "Budget", tint: color.pillar3, Icon: WalletIcon },
  famille: { label: "Famille", tint: color.pillar4, Icon: ProfileIcon },
};

type RouteItem = BottomTabBarProps["state"]["routes"][number];

export function CustomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [quickAdd, setQuickAdd] = useState(false);

  const routes = state.routes.filter((r: RouteItem) => TABS[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  function renderTab(route: RouteItem) {
    const isFocused = state.routes[state.index].key === route.key;
    const { label, Icon, tint: pillar } = TABS[route.name];
    const tint = isFocused ? pillar : color.neutral500;
    return (
      <Pressable
        key={route.key}
        onPress={() => navigateToTab(route.key)}
        style={{ flex: 1, alignItems: "center", gap: 4 }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            borderWidth: 2,
            borderColor: tint,
            alignItems: "center",
            justifyContent: "center",
            // Only a faint tint inside the ring, so the icon keeps strong contrast.
            backgroundColor: isFocused ? `${pillar}0d` : "transparent",
            boxShadow: isFocused ? `${glow(`${pillar}99`, 8)}, ${glow(`${pillar}40`, 18)}` : undefined,
          }}
        >
          <Icon size={19} color={tint} />
        </View>
        <Text size={10.5} style={{ color: tint }}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: (insets.bottom || 10) + space[4],
        paddingTop: 10,
        paddingHorizontal: 18,
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
          marginHorizontal: space[3],
          marginTop: -24,
          boxShadow: glow("rgba(76,196,255,0.5)", 18),
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
  );
}
