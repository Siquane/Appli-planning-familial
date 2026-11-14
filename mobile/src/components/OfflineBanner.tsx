import { View } from "react-native";
import { Text, TYPE } from "./Text";
import { useIsOnline } from "../state/networkStore";
import { useOutboxStore } from "../state/outboxStore";
import { color, gutter, space } from "../theme/tokens";
import { offlineBannerText } from "../lib/offlineText";

/** A thin strip at the top while the server can't be reached, or while changes are still waiting to be sent. */
export function OfflineBanner() {
  const online = useIsOnline();
  const waiting = useOutboxStore((s) => s.items.length);
  const text = offlineBannerText(online, waiting);
  if (!text) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.divider, paddingHorizontal: gutter, paddingVertical: space.xs }}>
      <Text size={TYPE.small} tone="muted" center>
        {text}
      </Text>
    </View>
  );
}
