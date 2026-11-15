import { useState } from "react";
import { Modal, View } from "react-native";
import { router } from "expo-router";
import { Text, TYPE } from "./Text";
import { Button } from "./Button";
import { Card } from "./Card";
import { familyApi } from "../api/resources";
import { noticeText } from "../lib/family";
import { syncUser } from "../lib/account";
import { useAuthStore } from "../state/authStore";
import { color, gutter, space } from "../theme/tokens";

/**
 * Shown once, at the next opening, to an account whose family changed hands
 * because its creator left. Closing it clears the message on the server.
 */
export function FamilyNoticeModal() {
  const notice = useAuthStore((s) => s.user?.familyNotice ?? null);
  const [closing, setClosing] = useState(false);
  if (!notice) return null;
  const { title, body, offers } = noticeText(notice);

  async function close(thenOffers = false) {
    setClosing(true);
    try {
      await familyApi.dismissNotice();
      await syncUser();
      if (thenOffers) router.push("/premium");
    } catch {
      // Offline: the message stays and shows again next time.
    } finally {
      setClosing(false);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close()}>
      <View style={{ flex: 1, backgroundColor: color.scrim, justifyContent: "center", padding: gutter }}>
        <Card style={{ gap: space.md }}>
          <Text heading size={TYPE.title}>
            {title}
          </Text>
          <Text tone="muted">{body}</Text>
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            {offers ? <Button label="Voir les offres" variant="primary" block loading={closing} onPress={() => close(true)} /> : null}
            <Button label="Compris" variant={offers ? "secondary" : "primary"} block loading={closing} onPress={() => close()} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
