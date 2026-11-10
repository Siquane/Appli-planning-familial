import { KeyboardAvoidingView, ScrollView, ScrollViewProps } from "react-native";

/**
 * A ScrollView that lifts its content above the on-screen keyboard. Android
 * draws edge-to-edge (forced since Expo 53), so the OS no longer resizes the
 * window when the keyboard opens: without this, the keyboard hides the lower
 * fields and buttons of a form.
 */
export function KeyboardScrollView(props: ScrollViewProps) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" {...props} />
    </KeyboardAvoidingView>
  );
}
