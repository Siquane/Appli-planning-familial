import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { Pressable } from "../src/components/Touchable";
import { KeyboardScrollView } from "../src/components/KeyboardScrollView";
import { Screen } from "../src/components/Screen";
import { Text } from "../src/components/Text";
import { Card } from "../src/components/Card";
import { Chip } from "../src/components/Chip";
import { Avatar } from "../src/components/Avatar";
import { TextField } from "../src/components/TextField";
import { Button } from "../src/components/Button";
import { TopBar } from "../src/components/TopBar";
import { GiftIcon, StarIcon, TrashIcon } from "../src/components/icons";
import { useAcceptRewardRequest, useAddReward, useDeclineRewardRequest, useMembers, useRedeemReward, useRemoveReward, useRemoveStarHistory, useRequestReward, useStars } from "../src/hooks/useApi";
import { isChild, starsLabel, weekKey } from "../src/lib/stars";
import { errorText } from "../src/lib/errors";
import { useToastStore } from "../src/state/toastStore";
import { useAuthStore, useIsChildAccount } from "../src/state/authStore";
import { color, space, gutter } from "../src/theme/tokens";

const toast = (m: string) => useToastStore.getState().show(m);

// Étoiles des enfants (moins de 15 ans) : un adulte coche « C'est fait » sur la
// fiche d'une tâche, les étoiles s'additionnent et s'échangent ici.
export default function StarsScreen() {
  const { data: members = [] } = useMembers();
  const { data: state, isLoading } = useStars(weekKey());
  const addReward = useAddReward();
  const removeReward = useRemoveReward();
  const redeem = useRedeemReward();
  const removeHistory = useRemoveStarHistory();
  const requestReward = useRequestReward();
  const acceptRequest = useAcceptRewardRequest();
  const declineRequest = useDeclineRewardRequest();
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");

  const children = members.filter((m) => isChild(m));
  // Un compte enfant regarde ses étoiles : c'est un adulte qui valide, ajoute les récompenses et fait les échanges.
  const viewerIsChild = useIsChildAccount();
  const viewerMemberId = useAuthStore((s) => s.user?.childMemberId ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    // Un enfant voit d'abord ses propres récompenses.
    if (viewerIsChild && viewerMemberId && children.some((c) => c.id === viewerMemberId)) {
      if (selected !== viewerMemberId) setSelected(viewerMemberId);
      return;
    }
    if (!selected || !children.some((c) => c.id === selected)) setSelected(children[0]?.id ?? null);
  }, [children, selected, viewerIsChild, viewerMemberId]);

  const requests = state?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const myRequests = viewerIsChild ? requests.filter((r) => r.memberId === viewerMemberId) : [];

  async function onRequest(rewardId: string, rewardTitle: string) {
    try {
      await requestReward.mutateAsync(rewardId);
      toast(`Demande envoyée pour « ${rewardTitle} ». Ton parent va répondre.`);
    } catch (e) {
      toast(errorText(e, "envoyer la demande"));
    }
  }

  async function onAccept(id: string, who: string, what: string) {
    try {
      await acceptRequest.mutateAsync(id);
      toast(`« ${what} » accepté pour ${who}.`);
    } catch (e) {
      toast(errorText(e, "accepter la demande"));
    }
  }

  async function onDecline(id: string) {
    try {
      await declineRequest.mutateAsync({ id, note: declineNote.trim() });
      setDecliningId(null);
      setDeclineNote("");
      toast("Demande refusée.");
    } catch (e) {
      toast(errorText(e, "refuser la demande"));
    }
  }

  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const costValue = Number(cost);
  const canAdd = title.trim().length > 0 && Number.isInteger(costValue) && costValue >= 1 && costValue <= 1000;

  const balanceOf = (memberId: string) => state?.children.find((c) => c.memberId === memberId)?.balance ?? 0;
  const nameOf = (memberId: string) => members.find((m) => m.id === memberId)?.name ?? "?";
  const chosen = children.find((c) => c.id === selected);

  async function onAdd() {
    if (!canAdd) return;
    try {
      await addReward.mutateAsync({ title: title.trim(), cost: costValue });
      setTitle("");
      setCost("");
      toast("Récompense ajoutée.");
    } catch (e) {
      toast(errorText(e, "ajouter la récompense"));
    }
  }

  function onRedeem(rewardId: string, rewardTitle: string, rewardCost: number) {
    if (!chosen) return;
    Alert.alert("Échanger des étoiles", `${chosen.name} échange ${starsLabel(rewardCost)} contre « ${rewardTitle} » ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Échanger",
        onPress: () =>
          redeem.mutate(
            { rewardId, memberId: chosen.id },
            { onSuccess: () => toast(`Bravo ${chosen.name} ! « ${rewardTitle} » est gagné.`), onError: (e) => toast(errorText(e, "échanger les étoiles")) },
          ),
      },
    ]);
  }

  function onRemoveReward(id: string, rewardTitle: string) {
    Alert.alert("Supprimer la récompense", `Supprimer « ${rewardTitle} » ? Les étoiles déjà échangées restent dans l'historique.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => removeReward.mutate(id) },
    ]);
  }

  function onRemoveHistory(id: string, label: string) {
    Alert.alert("Effacer de l'historique", `Effacer « ${label} » ? Le compte d'étoiles sera corrigé.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Effacer", style: "destructive", onPress: () => removeHistory.mutate(id) },
    ]);
  }

  return (
    <Screen scroll={false} padded={false}>
      <TopBar title="Étoiles et récompenses" onBack={() => router.back()} />
      <KeyboardScrollView contentContainerStyle={{ padding: gutter, gap: space.md }} showsVerticalScrollIndicator={false}>
        <Text size={13} tone="faint">
          Les enfants de moins de 15 ans gagnent des étoiles quand un adulte coche « C'est fait » sur la fiche d'une tâche qui leur est assignée. Les étoiles s'échangent contre les récompenses que tu choisis.
        </Text>

        {!isLoading && children.length === 0 && (
          <Card style={{ alignItems: "center", gap: space.sm, paddingVertical: space.lg }}>
            <StarIcon size={26} color={color.neutral600} />
            <Text size={13} tone="muted" center>
              Aucun enfant de moins de 15 ans pour l'instant. Indique l'âge ou la date de naissance dans la fiche du membre (onglet Famille).
            </Text>
          </Card>
        )}

        {!viewerIsChild && pending.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Demandes ({pending.length})
            </Text>
            {pending.map((r) => (
              <Card key={r.id} style={{ gap: space.sm, borderColor: color.pillar3, borderWidth: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <GiftIcon size={18} color={color.pillar4} />
                  <Text size={15} style={{ flex: 1 }}>
                    {nameOf(r.memberId)} demande « {r.title} »
                  </Text>
                  <Text size={13} tone="muted" mono>
                    {r.cost} ★
                  </Text>
                </View>
                <Text size={11} tone="faint">
                  {nameOf(r.memberId)} a {starsLabel(balanceOf(r.memberId))}.
                </Text>
                {decliningId === r.id ? (
                  <View style={{ gap: space.sm }}>
                    <TextField label="Un petit mot (facultatif)" value={declineNote} onChangeText={setDeclineNote} placeholder="Ex. Ce week-end plutôt" maxLength={200} />
                    <View style={{ flexDirection: "row", gap: space.sm }}>
                      <Button label="Annuler" variant="ghost" style={{ flex: 1 }} onPress={() => setDecliningId(null)} />
                      <Button label="Refuser" variant="secondary" style={{ flex: 1 }} needsNetwork loading={declineRequest.isPending} onPress={() => onDecline(r.id)} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    <Button label="Refuser" variant="secondary" style={{ flex: 1 }} onPress={() => { setDecliningId(r.id); setDeclineNote(""); }} />
                    <Button
                      label="Accepter"
                      variant="primary"
                      style={{ flex: 1 }}
                      needsNetwork
                      disabled={balanceOf(r.memberId) < r.cost}
                      loading={acceptRequest.isPending && acceptRequest.variables === r.id}
                      onPress={() => onAccept(r.id, nameOf(r.memberId), r.title)}
                    />
                  </View>
                )}
              </Card>
            ))}
          </View>
        )}

        {children.length > 0 && (
          <View style={{ gap: space.sm }}>
            {children.map((m) => {
              const info = state?.children.find((c) => c.memberId === m.id);
              const active = m.id === selected;
              return (
                <Pressable key={m.id} onPress={() => setSelected(m.id)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Card row style={{ alignItems: "center", gap: space.sm, borderColor: active ? color.pillar3 : undefined, borderWidth: active ? 1 : undefined }}>
                    <Avatar initials={m.initials} bg={m.tint === "neutral" ? color.neutral700 : color.accent800} fg={m.tint === "neutral" ? color.neutral100 : color.accent100} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text size={15} weight="medium">
                        {m.name}
                      </Text>
                      <Text size={11} tone="faint">
                        +{info?.weekStars ?? 0} ★ cette semaine
                      </Text>
                    </View>
                    <StarIcon size={20} color={color.pillar3} />
                    <Text size={22} weight="semibold" mono>
                      {info?.balance ?? 0}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Text weight="medium" size={13} tone="muted">
            Récompenses{chosen ? ` · pour ${chosen.name}` : ""}
          </Text>
          {children.length > 1 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {children.map((c) => (
                <Chip key={c.id} label={c.name} selected={c.id === selected} onPress={() => setSelected(c.id)} size="sm" />
              ))}
            </View>
          )}
          {(state?.rewards ?? []).length === 0 && (
            <Text size={13} tone="faint">
              Pas encore de récompense. Exemples : « Choisir le dessert » (5 étoiles), « Sortie cinéma » (20 étoiles).
            </Text>
          )}
          {state?.rewards.map((r) => {
            const missing = chosen ? r.cost - balanceOf(chosen.id) : r.cost;
            return (
              <Card key={r.id} row style={{ alignItems: "center", gap: space.sm }}>
                <GiftIcon size={18} color={color.pillar4} />
                <View style={{ flex: 1 }}>
                  <Text size={15}>{r.title}</Text>
                  <Text size={11} tone="faint">
                    {starsLabel(r.cost)}
                    {chosen && missing > 0 ? ` · encore ${missing} pour ${chosen.name}` : ""}
                  </Text>
                </View>
                {viewerIsChild && chosen && chosen.id === viewerMemberId && (
                  requests.some((q) => q.status === "pending" && q.rewardId === r.id && q.memberId === viewerMemberId) ? (
                    <Text size={11} tone="accent">
                      Demandée
                    </Text>
                  ) : missing <= 0 ? (
                    <Button label="Demander" variant="primary" needsNetwork loading={requestReward.isPending && requestReward.variables === r.id} onPress={() => onRequest(r.id, r.title)} />
                  ) : null
                )}
                {chosen && !viewerIsChild && (
                  <Button label="Échanger" variant={missing > 0 ? "secondary" : "primary"} disabled={missing > 0} needsNetwork onPress={() => onRedeem(r.id, r.title, r.cost)} />
                )}
                {!viewerIsChild && (
                  <Button variant="icon" icon={<TrashIcon size={16} color={color.neutral400} />} accessibilityLabel={`Supprimer ${r.title}`} onPress={() => onRemoveReward(r.id, r.title)} />
                )}
              </Card>
            );
          })}

          {!viewerIsChild && <Card style={{ gap: space.sm }}>
            <TextField label="Nouvelle récompense" value={title} onChangeText={setTitle} placeholder="Ex. Sortie cinéma" maxLength={80} />
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <TextField label="Étoiles" value={cost} onChangeText={(v) => setCost(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={4} placeholder="20" />
              </View>
              <Button label="Ajouter" variant="primary" disabled={!canAdd} loading={addReward.isPending} needsNetwork onPress={onAdd} />
            </View>
          </Card>}
        </View>

        {myRequests.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Mes demandes
            </Text>
            <Card>
              {myRequests.map((r, i) => (
                <View key={r.id} style={{ paddingVertical: space.sm, gap: 2, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                    <Text size={13} style={{ flex: 1 }} numberOfLines={1}>
                      {r.title} · {r.cost} ★
                    </Text>
                    <Text size={11} tone={r.status === "declined" ? "muted" : "accent"}>
                      {r.status === "pending" ? "En attente" : r.status === "accepted" ? "Acceptée 🎉" : "Pas cette fois"}
                    </Text>
                  </View>
                  {r.status === "declined" && r.note ? (
                    <Text size={11} tone="faint">
                      « {r.note} »
                    </Text>
                  ) : null}
                </View>
              ))}
            </Card>
          </View>
        )}

        {(state?.history ?? []).length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text weight="medium" size={13} tone="muted">
              Historique
            </Text>
            <Card>
              {state!.history.map((h, i) => {
                const label = `${h.kind === "earned" ? "+" : "−"}${h.stars} ★ ${nameOf(h.memberId)} · ${h.title}`;
                return (
                  <Pressable
                    key={h.id}
                    onLongPress={viewerIsChild ? undefined : () => onRemoveHistory(h.id, label)}
                    accessibilityHint="Appui long pour effacer"
                    style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingVertical: space.sm, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: color.divider }}
                  >
                    <Text size={13} mono style={{ width: 44 }} tone={h.kind === "earned" ? "text" : "muted"}>
                      {h.kind === "earned" ? "+" : "−"}
                      {h.stars} ★
                    </Text>
                    <Text size={13} style={{ flex: 1 }} numberOfLines={1}>
                      {nameOf(h.memberId)} · {h.title}
                    </Text>
                    <Text size={11} tone="faint">
                      {new Date(h.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>
            {!viewerIsChild && (
              <Text size={11} tone="faint">
                Appui long sur une ligne pour l'effacer (erreur de coche ou d'échange).
              </Text>
            )}
          </View>
        )}
      </KeyboardScrollView>
    </Screen>
  );
}
