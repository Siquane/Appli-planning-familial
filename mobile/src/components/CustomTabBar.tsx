import { useState } from "react";
import { View, Pressable } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarIcon, MealIcon, WalletIcon, ProfileIcon, PlusIcon } from "./icons";
import { Text } from "./Text";
import { QuickAddSheet } from "./QuickAddSheet";
import { color, space } from "../theme/tokens";

// The 4 pillars of Passerelle, two on each side of the « + ».
// Each takes the colour of its ring in the logo (cyan → violet).
const TABS: Record<string, { label: string; tint: string; Icon: (props: { size: number; color: string }) => React.JSX.Element }> = {
  home: { label: "Planning", tint: color.pillar1, Icon: CalendarIcon },
  repas: { label: "Repas", tint: color.pillar2, Icon: MealIcon },
  budget: { label: "Budget", tint: color.pillar3, Icon: WalletIcon },
  famille: { label: "Famille", tint: color.pillar4, Icon: ProfileIcon },
};

type RouteItem = BottomTabBarProps["state"]["routes"][number];

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
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
        onPress={() => navigation.navigate(route.name)}
        style={{ flex: 1, alignItems: "center", gap: 3 }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isFocused }}
      >
        {/* The active tab shows its ring, like the logo's points. */}
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: isFocused ? pillar : "transparent",
            marginBottom: 1,
          }}
        />
        <Icon size={22} color={tint} />
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
          width: 50,
          height: 50,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: color.accent,
          alignItems: "center",
          justifyContent: "center",
          marginHorizontal: space[3],
          marginTop: -22,
          backgroundColor: color.bg,
        }}
      >
        <PlusIcon size={22} color={color.accent} />
      </Pressable>

      {right.map(renderTab)}

      <QuickAddSheet visible={quickAdd} onClose={() => setQuickAdd(false)} />
    </View>
  );
}
