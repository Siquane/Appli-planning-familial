import { useState } from "react";
import { View } from "react-native";
import { router, Link } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/state/authStore";
import { useSlowHint } from "../../src/hooks/useSlowHint";
import { space } from "../../src/theme/tokens";
import { errorText } from "../../src/lib/errors";

// Enfant de moins de 15 ans : il se connecte avec le code qu'un parent a créé
// (Famille → fiche du membre → « Créer l'accès »). Pas d'e-mail ni de mot de passe.
export default function ChildCodeScreen() {
  const signInWithChildCode = useAuthStore((s) => s.signInWithChildCode);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slow = useSlowHint(loading);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signInWithChildCode(code.trim());
      router.replace("/");
    } catch (e) {
      setError(errorText(e, "te connecter"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard style={{ justifyContent: "center", gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Text heading weight="semibold" size={28}>
          J'ai un code enfant
        </Text>
        <Text tone="muted" size={15}>
          Demande à ton parent d'ouvrir Passerelle : Famille → ta fiche → « Créer mon accès ». Il te donne un code à 8 caractères, valable 24 h.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        <TextField label="Code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="K7F2-9QXA" maxLength={12} />
        {error && (
          <Text tone="danger" size={13}>
            {error}
          </Text>
        )}
        <Button label="Entrer" variant="primary" block onPress={onSubmit} loading={loading} disabled={code.replace(/[^A-Za-z0-9]/g, "").length < 8} />
        {slow && (
          <Text tone="muted" size={13} center>
            Passerelle se réveille, ça peut prendre jusqu'à une minute…
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.sm }}>
        <Link href="/(auth)/login">
          <Text tone="accent" size={13} weight="medium">
            Revenir à la connexion
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
