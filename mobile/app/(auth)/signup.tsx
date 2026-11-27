import { useState } from "react";
import { View } from "react-native";
import { Pressable } from "../../src/components/Touchable";
import { CheckIcon } from "../../src/components/icons";
import { router, Link, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/state/authStore";
import { useSlowHint } from "../../src/hooks/useSlowHint";
import { color, space } from "../../src/theme/tokens";
import { errorText } from "../../src/lib/errors";

export default function SignupScreen() {
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Joining a family with the code a parent gave. Any account needs the confirmation of being 15 or older.
  // « Rejoindre une famille » depuis l'écran de connexion : champ du code déjà ouvert.
  const { code: withCode } = useLocalSearchParams<{ code?: string }>();
  const [hasCode, setHasCode] = useState(withCode === "1");
  const [code, setCode] = useState("");
  const [age15, setAge15] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slow = useSlowHint(loading);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim(), { age15, ...(hasCode ? { code: code.trim() } : {}) });
      router.replace("/");
    } catch (e) {
      setError(errorText(e, "créer le compte"));
    } finally {
      setLoading(false);
    }
  }

  // Dit ce qui manque plutôt qu'un bouton simplement grisé.
  const missing: string[] = [];
  if (!name.trim()) missing.push("ton prénom");
  if (!email.trim()) missing.push("ton adresse e-mail");
  if (password.length < 8) missing.push("un mot de passe de 8 caractères minimum");
  if (!age15) missing.push("la case « J'ai 15 ans ou plus »");
  if (hasCode && !code.trim()) missing.push("le code famille");

  return (
    <Screen keyboard style={{ justifyContent: "center", gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text heading weight="semibold" size={28}>
          {hasCode ? "Rejoindre une famille" : "Créer un compte"}
        </Text>
        <Text tone="muted" size={15}>
          {hasCode ? "Crée ton compte avec le code donné par un parent." : "Quelques infos pour démarrer."}
        </Text>
      </View>

      <View style={{ gap: space.sm }}>
        <TextField label="Prénom" value={name} onChangeText={setName} placeholder="Ex. Claire" autoCapitalize="words" />
        <TextField label="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="toi@exemple.fr" />
        <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="8 caractères minimum" />
        <Pressable
          onPress={() => setAge15(!age15)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: age15 }}
          accessibilityLabel="J'ai 15 ans ou plus"
          style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: age15 ? color.pillar2 : color.neutral600,
              backgroundColor: age15 ? color.pillar2 : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {age15 && <CheckIcon size={14} color={color.bg} />}
          </View>
          <Text size={13} style={{ flex: 1 }}>
            J'ai 15 ans ou plus
          </Text>
        </Pressable>
        {!age15 && (
          <Text size={12} tone="faint">
            Moins de 15 ans ? Un parent te crée un accès enfant depuis sa fiche Famille, puis touche « J'ai un code enfant » à la connexion.
          </Text>
        )}
        {hasCode ? (
          <View style={{ gap: space.sm }}>
            <TextField label="Code famille" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="K7F2-9QXA" maxLength={12} />
            <Pressable onPress={() => setHasCode(false)} accessibilityLabel="Je n'ai pas de code">
              <Text tone="accent" size={13} weight="medium">
                Je n'ai pas de code famille
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: space.xs }}>
            <Pressable onPress={() => setHasCode(true)} accessibilityLabel="J'ai un code famille">
              <Text tone="accent" size={13} weight="medium">
                J'ai un code famille
              </Text>
            </Pressable>
            <Text tone="faint" size={12}>
              Sans code, tu crées ta propre famille.
            </Text>
          </View>
        )}
        {error && (
          <Text tone="danger" size={13}>
            {error}
          </Text>
        )}
        <Button label={hasCode ? "Rejoindre la famille" : "Créer mon compte"} variant="primary" block onPress={onSubmit} loading={loading} disabled={missing.length > 0} />
        {missing.length > 0 && (
          <Text tone="muted" size={13} center>
            Il manque : {missing.join(", ")}.
          </Text>
        )}
        {slow && (
          <Text tone="muted" size={13} center>
            Passerelle se réveille, ça peut prendre jusqu'à une minute…
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.sm }}>
        <Text tone="muted" size={13}>
          Déjà un compte ?
        </Text>
        <Link href="/(auth)/login">
          <Text tone="accent" size={13} weight="medium">
            Se connecter
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
