import { KeyboardAvoidingView, ScrollView, ScrollViewProps, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A ScrollView that lifts its content above the on-screen keyboard. Android
 * draws edge-to-edge (forced since Expo 53), so the OS no longer resizes the
 * window when the keyboard opens: without this, the keyboard hides the lower
 * fields and buttons of a form.
 *
 * The end of the content also gets room for the phone's navigation buttons
 * and a margin, so the last button of a form (« Créer », « Enregistrer »)
 * can always be scrolled fully into view, keyboard open or not.
 */
export function KeyboardScrollView({ contentContainerStyle, ...props }: ScrollViewProps) {
  const bottom = useSafeAreaInsets().bottom;
  const flat = StyleSheet.flatten(contentContainerStyle) ?? {};
  const base = Number(flat.paddingBottom ?? flat.paddingVertical ?? flat.padding ?? 0) || 0;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" {...props} contentContainerStyle={[flat, { paddingBottom: base + bottom + 48 }]} />
    </KeyboardAvoidingView>
  );
}
