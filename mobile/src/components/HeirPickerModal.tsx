import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { Text, TYPE } from "./Text";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckIcon } from "./icons";
import type { HeirChoice } from "../lib/family";
import { color, gutter, space } from "../theme/tokens";

interface Props {
  heirs: HeirChoice[];
  busy: boolean;
  onConfirm: (heirId: string) => void;
  onCancel: () => void;
}

/** Asked when the creator deletes their account and several adults could take the family over: who gets it. */
export function HeirPickerModal({ heirs, busy, onConfirm, onCancel }: Props) {
  const [chosen, setChosen] = useState(heirs[0]?.id ?? null);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: "rgba(7,9,18,0.85)", justifyContent: "center", padding: gutter }}>
        <Card style={{ gap: space.md }}>
          <Text heading size={TYPE.title}>
            Qui reprend la famille ?
          </Text>
          <Text tone="muted">Cette personne reçoit le planning, le budget et les documents de la famille. Les autres comptes la suivent et gardent leurs données personnelles.</Text>
          <View style={{ gap: space.xs }}>
            {heirs.map((h) => {
              const selected = h.id === chosen;
              return (
                <Pressable
                  key={h.id}
                  onPress={() => setChosen(h.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={h.name}
                  style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.xs }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1.5,
                      borderColor: selected ? color.pillar2 : color.neutral600,
                      backgroundColor: selected ? color.pillar2 : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selected && <CheckIcon size={14} color={color.bg} />}
                  </View>
                  <Text style={{ flex: 1 }}>{h.name}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ gap: space.sm }}>
            <Button label="Confier et supprimer mon compte" variant="primary" block loading={busy} disabled={!chosen} onPress={() => chosen && onConfirm(chosen)} />
            <Button label="Annuler" variant="secondary" block disabled={busy} onPress={onCancel} />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
