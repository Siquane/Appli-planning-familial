import { useState } from "react";
import { Pressable, hitSlopFor } from "../components/Touchable";
import { TextInput, View } from "react-native";
import { Text, scaled } from "../components/Text";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { CheckIcon, CloseIcon } from "../components/icons";
import { useAddShoppingItem, useClearCheckedShopping, useDeleteShoppingItem, useShoppingFromMenu, useShoppingList, useToggleShoppingItem } from "../hooks/useApi";
import { useToastStore } from "../state/toastStore";
import { fromMenuMessage } from "../lib/shopping";
import { color, font, radius, space } from "../theme/tokens";
import { errorText } from "../lib/errors";
import { EmptyState } from "../components/Playful";

const toast = (m: string) => useToastStore.getState().show(m);

/** Shopping list, shown in the « Repas » tab. */
export function ShoppingBody() {
  const { data: items = [], isLoading } = useShoppingList();
  const add = useAddShoppingItem();
  const toggle = useToggleShoppingItem();
  const remove = useDeleteShoppingItem();
  const fromMenu = useShoppingFromMenu();
  const clearChecked = useClearCheckedShopping();
  const [label, setLabel] = useState("");

  const toBuy = items.filter((i) => !i.checked);
  const inBasket = items.filter((i) => i.checked);

  function onAdd() {
    const value = label.trim();
    if (!value) return;
    add.mutate(value, { onSuccess: () => setLabel(""), onError: (e) => toast(errorText(e, "mettre à jour la liste")) });
  }

  function onFromMenu() {
    fromMenu.mutate(undefined, {
      onSuccess: (r) => toast(fromMenuMessage(r.added, r.withoutIngredients)),
      onError: (e) => toast(errorText(e, "mettre à jour la liste")),
    });
  }

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          onSubmitEditing={onAdd}
          returnKeyType="done"
          placeholder="Ajouter un article…"
          placeholderTextColor={color.neutral600}
          style={{
            flex: 1,
            color: color.text,
            fontFamily: font.body,
            fontSize: scaled(15),
            paddingVertical: space.md,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            backgroundColor: color.surface,
            borderWidth: 1,
            borderColor: color.divider,
          }}
        />
        <Button label="Ajouter" variant="secondary" onPress={onAdd} disabled={!label.trim()} loading={add.isPending} />
      </View>

      <Button label="Générer depuis le menu de la semaine" variant="ghost" block onPress={onFromMenu} loading={fromMenu.isPending} />

      {!isLoading && items.length === 0 && (
        <Card>
          <EmptyState title="Panier vide 🧺" detail="Ajoutez des articles, ou générez la liste depuis le menu de la semaine." />
        </Card>
      )}

      {toBuy.length > 0 && (
        <Card style={{ gap: 0 }}>
          {toBuy.map((item, i) => (
            <Row key={item.id} label={item.label} checked={false} first={i === 0} onToggle={() => toggle.mutate({ id: item.id, checked: true })} onRemove={() => remove.mutate(item.id)} />
          ))}
        </Card>
      )}

      {inBasket.length > 0 && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text size={13} tone="muted" style={{ flex: 1 }}>
              Dans le panier ({inBasket.length})
            </Text>
            <Button label="Vider" variant="ghost" onPress={() => clearChecked.mutate()} loading={clearChecked.isPending} />
          </View>
          <Card style={{ gap: 0 }}>
            {inBasket.map((item, i) => (
              <Row key={item.id} label={item.label} checked first={i === 0} onToggle={() => toggle.mutate({ id: item.id, checked: false })} onRemove={() => remove.mutate(item.id)} />
            ))}
          </Card>
        </View>
      )}
    </View>
  );
}

function Row({ label, checked, first, onToggle, onRemove }: { label: string; checked: boolean; first: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: space.sm, borderTopWidth: first ? 0 : 1, borderTopColor: color.divider }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={label}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: checked ? color.pillar2 : color.neutral600,
            backgroundColor: checked ? color.pillar2 : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {checked && <CheckIcon size={14} color={color.bg} />}
        </View>
        <Text size={15} tone={checked ? "faint" : "text"} style={checked ? { textDecorationLine: "line-through" } : undefined}>
          {label}
        </Text>
      </Pressable>
      <Pressable hitSlop={hitSlopFor(26)} onPress={onRemove} accessibilityLabel={`Retirer ${label}`} style={{ padding: space.sm }}>
        <CloseIcon size={14} color={color.neutral500} />
      </Pressable>
    </View>
  );
}
