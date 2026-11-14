import { TextInput, TextInputProps, View } from "react-native";
import { Text, scaled } from "./Text";
import { color, radius, space } from "../theme/tokens";

interface Props extends TextInputProps {
  label?: string;
  multiline?: boolean;
}

export function TextField({ label, style, multiline, ...rest }: Props) {
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
        style={[
          {
            minHeight: multiline ? 90 : 44,
            paddingVertical: 6,
            paddingHorizontal: 10,
            fontSize: scaled(15),
            color: color.text,
            backgroundColor: color.surface,
            borderWidth: 1,
            borderColor: color.divider,
            borderRadius: radius.md,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
