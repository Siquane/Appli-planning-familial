import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Text } from "./Text";
import { Avatar } from "./Avatar";
import { GradientFill, PasserelleArch } from "./Brand";
import { BellIcon, ChevronLeftIcon, SearchIcon } from "./icons";
import { useNotifications } from "../hooks/useApi";
import { useAuthStore } from "../state/authStore";
import { color, space } from "../theme/tokens";

const iconButton = {
  width: 36,
  height: 36,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: color.divider,
  alignItems: "center",
  justifyContent: "center",
} as const;

// Top of each of the 4 tabs: the Passerelle arch and the tab's title, then
// search, notifications (dot when unread) and the profile avatar — they used
// to be tabs themselves. A gradient line across the whole screen closes the header.
export function TabHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: notifications = [] } = useNotifications();
  const hasUnread = notifications.some((n) => n.unread);

  return (
    <View style={{ gap: space[4] }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <PasserelleArch width={42} />
          <View style={{ flexShrink: 1 }}>
            <Text heading weight="semibold" size={22} numberOfLines={1}>
              {title}
            </Text>
          </View>
        </View>
        {subtitle ? (
          <Text size={12.5} tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={() => router.push("/search")} accessibilityLabel="Rechercher" style={iconButton}>
        <SearchIcon size={18} color={color.text} />
      </Pressable>
      <Pressable onPress={() => router.push("/inbox")} accessibilityLabel={hasUnread ? "Notifications non lues" : "Notifications"} style={iconButton}>
        <BellIcon size={18} color={color.text} />
        {hasUnread && (
          <View style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: 3.5, backgroundColor: color.accent }} />
        )}
      </Pressable>
      <Pressable onPress={() => router.push("/profile")} accessibilityLabel="Mon profil">
        <Avatar initials={user?.initials ?? ""} bg={color.accent800} fg={color.accent100} size={36} />
      </Pressable>
    </View>
    {/* Edge to edge: cancels the 18 px side padding of the tab screens. */}
    <View style={{ height: 2, marginHorizontal: -18 }}>
      <GradientFill />
    </View>
    </View>
  );
}

// Secondary pages opened from those icons: back button + title (+ an optional action).
export function BackHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour" style={{ ...iconButton, width: 34, height: 34 }}>
        <ChevronLeftIcon size={17} color={color.text} />
      </Pressable>
      <Text heading weight="semibold" size={20} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
