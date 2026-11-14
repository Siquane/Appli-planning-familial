import { useState } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { Text, scaled } from "./Text";
import { color, radius, space } from "../theme/tokens";

interface Props extends TextInputProps {
  label?: string;
  multiline?: boolean;
  /** Shown in red under the field, which gets a red border; announced to screen readers. */
  error?: string | null;
}

// Border: accent while typing, red when `error` is set, divider otherwise.
export function TextField({ label, style, multiline, error, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? color.danger : focused ? color.accent600 : color.divider;
  return (
    <View style={{ gap: space[2] }}>
      {label ? (
        <Text size={13} tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={color.neutral500}
        multiline={multiline}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        accessibilityHint={error ?? undefined}
        maxFontSizeMultiplier={1.4}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            minHeight: multiline ? 90 : 44,
            paddingVertical: 6,
            paddingHorizontal: 10,
            fontSize: scaled(15),
            color: color.text,
            backgroundColor: color.surface,
            borderWidth: focused || error ? 1.5 : 1,
            borderColor,
            borderRadius: radius.md,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text size={11} tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
