import { Image, Pressable, View } from "react-native";
import { Card } from "./Card";
import { Text } from "./Text";
import { DocumentIcon } from "./icons";
import { isImage } from "../lib/documentUpload";
import { color, radius, space } from "../theme/tokens";
import type { FamilyDocument } from "../api/types";

export function DocumentRow({ doc, subtitle, onPress, onLongPress }: { doc: FamilyDocument; subtitle: string; onPress: () => void; onLongPress?: () => void }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <Card row style={{ alignItems: "center" }}>
        {isImage(doc) && doc.url ? (
          <Image source={{ uri: doc.url }} style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.neutral800 }} />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.neutral800, alignItems: "center", justifyContent: "center" }}>
            <DocumentIcon size={18} color={color.accent400} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: space[3] }}>
          <Text size={14} weight="medium" numberOfLines={1}>
            {doc.title}
          </Text>
          <Text size={11.5} tone="faint" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
