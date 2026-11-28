import { useState } from "react";
import { Animated, View } from "react-native";
import { useFill } from "./motion";
import { Text } from "./Text";
import { Card } from "./Card";
import { Button } from "./Button";
import { TextField } from "./TextField";
import { StarIcon } from "./icons";
import { useAcceptClaim, useDeclineClaim, useSetStarGoal } from "../hooks/useApi";
import { errorText } from "../lib/errors";
import { starsLabel } from "../lib/stars";
import { useToastStore } from "../state/toastStore";
import { color, space } from "../theme/tokens";
import type { StarClaim, StarsState } from "../api/types";

// Écran Étoiles : les « J'ai fini ! » des ados à valider, et l'objectif
// commun de la famille (une jauge que les étoiles de la semaine remplissent).

const toast = (m: string) => useToastStore.getState().show(m);

export function ClaimsToValidate({ claims, nameOf }: { claims: StarClaim[]; nameOf: (memberId: string) => string }) {
  const accept = useAcceptClaim();
  const decline = useDeclineClaim();
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (claims.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text weight="medium" size={13} tone="muted">
        Tâches à valider ({claims.length})
      </Text>
      {claims.map((c) => (
        <Card key={c.id} style={{ gap: space.sm, borderColor: color.pillar3, borderWidth: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <StarIcon size={18} color={color.pillar3} />
            <Text size={15} style={{ flex: 1 }}>
              {nameOf(c.memberId)} a fini « {c.title} »
            </Text>
            <Text size={13} tone="muted" mono>
              +{c.stars} ★
            </Text>
          </View>
          {declining === c.id ? (
            <View style={{ gap: space.sm }}>
              <TextField label="Ce qu'il reste à faire (facultatif)" value={note} onChangeText={setNote} placeholder="Ex. Le lit n'est pas fait" maxLength={200} />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button label="Annuler" variant="ghost" style={{ flex: 1 }} onPress={() => setDeclining(null)} />
                <Button
                  label="Pas encore"
                  variant="secondary"
                  style={{ flex: 1 }}
                  needsNetwork
                  loading={decline.isPending}
                  onPress={() =>
                    decline.mutate(
                      { id: c.id, note: note.trim() },
                      { onSuccess: () => { setDeclining(null); setNote(""); toast(`${nameOf(c.memberId)} est prévenu.`); }, onError: (e) => toast(errorText(e, "répondre")) },
                    )
                  }
                />
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Button label="Pas encore" variant="secondary" style={{ flex: 1 }} onPress={() => { setDeclining(c.id); setNote(""); }} />
              <Button
                label="Valider"
                variant="primary"
                style={{ flex: 1 }}
                needsNetwork
                loading={accept.isPending && accept.variables === c.id}
                onPress={() => accept.mutate(c.id, { onSuccess: () => toast(`+${starsLabel(c.stars)} pour ${nameOf(c.memberId)} !`), onError: (e) => toast(errorText(e, "valider")) })}
              />
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

export function FamilyGoalCard({ goal, canEdit }: { goal: StarsState["goal"]; canEdit: boolean }) {
  const setGoal = useSetStarGoal();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const targetValue = Number(target);
  const valid = title.trim().length > 0 && Number.isInteger(targetValue) && targetValue >= 1 && targetValue <= 500;
  const fill = useFill(goal ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0);

  if (!goal && !canEdit) return null;

  if (editing) {
    return (
      <Card style={{ gap: space.sm }}>
        <Text weight="medium" size={15}>
          Objectif de la famille
        </Text>
        <Text size={13} tone="muted">
          Toutes les étoiles gagnées par les enfants cette semaine remplissent la jauge. Quand elle est pleine, tout le monde est prévenu.
        </Text>
        <TextField label="L'objectif" value={title} onChangeText={setTitle} placeholder="Ex. Soirée pizza" maxLength={80} />
        <TextField label="Étoiles à gagner ensemble dans la semaine" value={target} onChangeText={setTarget} keyboardType="number-pad" placeholder="Ex. 30" maxLength={3} />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button label="Annuler" variant="ghost" style={{ flex: 1 }} onPress={() => setEditing(false)} />
          <Button
            label="Enregistrer"
            variant="primary"
            style={{ flex: 1 }}
            disabled={!valid}
            needsNetwork
            loading={setGoal.isPending}
            onPress={() => setGoal.mutate({ title: title.trim(), target: targetValue }, { onSuccess: () => setEditing(false), onError: (e) => toast(errorText(e, "enregistrer l'objectif")) })}
          />
        </View>
        {goal ? <Button label="Supprimer l'objectif" variant="ghost" onPress={() => setGoal.mutate(null, { onSuccess: () => setEditing(false) })} /> : null}
      </Card>
    );
  }

  if (!goal) {
    return (
      <Button
        label="Fixer un objectif pour toute la famille"
        variant="secondary"
        block
        onPress={() => {
          setTitle("");
          setTarget("");
          setEditing(true);
        }}
      />
    );
  }

  return (
    <Card style={{ gap: space.sm, borderColor: goal.reached ? color.pillar3 : undefined, borderWidth: goal.reached ? 1 : undefined }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Text weight="medium" size={15} style={{ flex: 1 }}>
          {goal.reached ? `Objectif atteint : ${goal.title} !` : `Objectif de la semaine : ${goal.title}`}
        </Text>
        <Text size={13} mono tone="accent">
          {Math.min(goal.progress, goal.target)}/{goal.target} ★
        </Text>
      </View>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: color.neutral800, overflow: "hidden" }}>
        <Animated.View style={{ width: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), height: "100%", borderRadius: 6, backgroundColor: color.pillar3 }} />
      </View>
      <Text size={12} tone="faint">
        {goal.reached ? "Bravo à toute la famille ! La jauge repart à zéro lundi." : `Encore ${starsLabel(goal.target - goal.progress)} à gagner ensemble cette semaine.`}
      </Text>
      {canEdit ? (
        <Button
          label="Modifier"
          variant="ghost"
          onPress={() => {
            setTitle(goal.title);
            setTarget(String(goal.target));
            setEditing(true);
          }}
        />
      ) : null}
    </Card>
  );
}
