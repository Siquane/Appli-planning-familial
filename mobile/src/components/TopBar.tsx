import { ActivityIndicator, View } from "react-native";
import { useIsOnline } from "../state/networkStore";
import { Pressable, hitSlopFor } from "./Touchable";
import { Text } from "./Text";
import { ChevronLeftIcon, CopyIcon, EditIcon, TrashIcon } from "./icons";
import { color, space, gutter } from "../theme/tokens";

interface Props {
  title: string;
  onBack: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * Bouton « Enregistrer » en haut à droite : toujours visible, même clavier
   * ouvert (le bouton du bas, lui, peut se retrouver caché sous le clavier).
   */
  save?: { onPress: () => void; label?: string; disabled?: boolean; loading?: boolean; needsNetwork?: boolean };
}

export function TopBar({ title, onBack, onDuplicate, onEdit, onDelete, save }: Props) {
  const online = useIsOnline();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: gutter, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.divider }}>
      <Pressable hitSlop={hitSlopFor(34)}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Retour"
        style={{ width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: color.divider, alignItems: "center", justifyContent: "center" }}
      >
        <ChevronLeftIcon size={17} color={color.text} />
      </Pressable>
      <Text heading weight="medium" size={17} style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {save && <SaveButton {...save} disabled={save.disabled || save.loading || (save.needsNetwork && !online)} />}
      {(onDuplicate || onEdit || onDelete) && (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          {onDuplicate && (
            <Pressable hitSlop={hitSlopFor(36)} onPress={onDuplicate} accessibilityLabel="Dupliquer" style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: color.divider, alignItems: "center", justifyContent: "center" }}>
              <CopyIcon size={16} color={color.text} />
            </Pressable>
          )}
          {onEdit && (
            <Pressable hitSlop={hitSlopFor(36)} onPress={onEdit} accessibilityLabel="Modifier" style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: color.divider, alignItems: "center", justifyContent: "center" }}>
              <EditIcon size={16} color={color.text} />
            </Pressable>
          )}
          {onDelete && (
            <Pressable hitSlop={hitSlopFor(36)} onPress={onDelete} accessibilityLabel="Supprimer" style={{ width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: color.divider, alignItems: "center", justifyContent: "center" }}>
              <TrashIcon size={16} color={color.text} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function SaveButton({ onPress, label = "Enregistrer", disabled, loading }: NonNullable<Props["save"]>) {
  return (
    <Pressable
      hitSlop={hitSlopFor(36)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={{
        height: 36,
        paddingHorizontal: space.md,
        borderRadius: 8,
        backgroundColor: disabled ? "transparent" : color.accent,
        borderWidth: 1,
        borderColor: disabled ? color.divider : color.accent,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color.text} />
      ) : (
        <Text weight="semibold" size={14} style={{ color: disabled ? color.neutral500 : color.onGradient }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
