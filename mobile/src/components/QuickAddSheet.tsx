import { Modal, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { useIsChildAccount } from "../state/authStore";
import { BookIcon, CalendarIcon, ClockIcon, DocumentIcon, MealIcon, NoteIcon, WalletIcon } from "./icons";
import { color, radius, space } from "../theme/tokens";

type Item = { label: string; hint: string; href: Href; Icon: (p: { size: number; color: string }) => React.JSX.Element };

export const QUICK_ADD_ITEMS: Item[] = [
  { label: "Tâche", hint: "Planning de la famille", href: "/task/new", Icon: CalendarIcon },
  { label: "Rendez-vous", hint: "À une date précise", href: "/task/new?kind=appointment", Icon: ClockIcon },
  { label: "Dépense", hint: "À partager (comptes)", href: "/comptes/expense", Icon: WalletIcon },
  { label: "Document", hint: "Ordonnance, assurance…", href: "/document/new", Icon: DocumentIcon },
  { label: "Recette", hint: "Livre de recettes", href: "/recipe/new", Icon: BookIcon },
  { label: "Repas", hint: "Menu de la semaine", href: "/repas", Icon: MealIcon },
  { label: "Note", hint: "Pour la famille ou pour toi", href: "/note/new", Icon: NoteIcon },
];

// Opened by the central « + » of the tab bar: one tap to reach any "add" form.
// Un compte enfant n'ajoute ni recettes ni repas.
const CHILD_HIDDEN = ["Recette", "Repas"];

export function QuickAddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const isChild = useIsChildAccount();
  const insets = useSafeAreaInsets();

  function go(href: Href) {
    onClose();
    router.push(href);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} accessibilityLabel="Fermer">
        <Pressable
          accessible={false}
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: color.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: space.md,
            paddingBottom: (insets.bottom || 10) + space.md,
            gap: space.xs,
          }}
        >
          <Text heading weight="semibold" size={17} style={{ marginBottom: space.sm }}>
            Ajouter
          </Text>
          {QUICK_ADD_ITEMS.filter((i) => !isChild || !CHILD_HIDDEN.includes(i.label)).map(({ label, hint, href, Icon }) => (
            <Pressable
              key={label}
              onPress={() => go(href)}
              accessibilityRole="button"
              accessibilityLabel={`Ajouter : ${label}`}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                paddingVertical: space.sm,
                paddingHorizontal: space.sm,
                borderRadius: radius.md,
                backgroundColor: pressed ? color.neutral900 : "transparent",
              })}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color.accent900, alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color={color.accent300} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="medium">
                  {label}
                </Text>
                <Text size={12} tone="faint">
                  {hint}
                </Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
