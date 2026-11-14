import { useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { DocumentRow } from "../src/components/DocumentRow";
import { DocumentIcon, PlusIcon } from "../src/components/icons";
import { MoreLink } from "../src/components/MoreLink";
import { useDocuments, useMembers, usePlan } from "../src/hooks/useApi";
import { Pressable } from "react-native";
import { categoryLabel, DOCUMENT_CATEGORIES } from "../src/lib/documentUpload";
import { color, space } from "../src/theme/tokens";
import type { DocumentCategory } from "../src/api/types";

export default function DocumentsScreen() {
  const { data: documents = [], isLoading } = useDocuments();
  const { data: members = [] } = useMembers();
  const { data: plan } = usePlan();
  const docLimit = plan?.documents.limit ?? null;
  const full = docLimit !== null && plan!.documents.used >= docLimit;
  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  const visible = documents.filter((d) => (!category || d.category === category) && (!memberId || d.memberId === memberId));
  const filtered = category !== null || memberId !== null;

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Documents" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: space[2] }} showsVerticalScrollIndicator={false}>
        <Button
          label={full ? "Ajouter un document · Passerelle+" : "Ajouter un document"}
          icon={<PlusIcon size={16} color={color.text} />}
          variant="secondary"
          block
          onPress={() => router.push(full ? "/premium" : "/document/new")}
        />
        {docLimit !== null && (
          <Pressable onPress={() => router.push("/premium")}>
            <Text size={11.5} tone={full ? "accent" : "faint"} center>
              {plan!.documents.used} / {docLimit} documents gratuits
            </Text>
            {full && <MoreLink label="Illimités avec une offre" size={11.5} center />}
          </Pressable>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingVertical: space[1] }}>
          <Chip label="Tous" size="sm" selected={category === null} onPress={() => setCategory(null)} />
          {DOCUMENT_CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} size="sm" selected={category === c.value} onPress={() => setCategory(category === c.value ? null : c.value)} />
          ))}
        </ScrollView>

        {members.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingBottom: space[1] }}>
            <Chip label="Toute la famille" size="sm" selected={memberId === null} onPress={() => setMemberId(null)} />
            {members.map((m) => (
              <Chip key={m.id} label={m.name} size="sm" selected={memberId === m.id} onPress={() => setMemberId(memberId === m.id ? null : m.id)} />
            ))}
          </ScrollView>
        )}

        {!isLoading && visible.length === 0 && (
          <Card style={{ alignItems: "center", paddingVertical: space[8] }}>
            <DocumentIcon size={22} color={color.neutral600} />
            <Text tone="muted" size={13} center style={{ marginTop: space[2] }}>
              {filtered ? "Aucun document pour ce filtre." : "Aucun document pour l'instant.\nOrdonnances, assurances, papiers de l'école…"}
            </Text>
          </Card>
        )}

        {visible.map((doc) => {
          const member = doc.memberId ? members.find((m) => m.id === doc.memberId) : undefined;
          const date = new Date(doc.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
          const subtitle = [categoryLabel(doc.category), member?.name, date].filter(Boolean).join(" · ");
          return <DocumentRow key={doc.id} doc={doc} subtitle={subtitle} onPress={() => router.push(`/document/${doc.id}`)} />;
        })}

        <View style={{ height: space[4] }} />
      </ScrollView>
    </Screen>
  );
}
