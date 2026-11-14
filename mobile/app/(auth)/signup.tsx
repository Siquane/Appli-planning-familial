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

export default function SignupScreen() {
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slow = useSlowHint(loading);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace("/");
    } catch (e) {
      setError(errorText(e, "créer le compte"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboard style={{ justifyContent: "center", gap: space[6] }}>
      <View style={{ gap: 4 }}>
        <Text heading weight="semibold" size={28}>
          Créer un compte
        </Text>
        <Text tone="muted" size={15}>
          Quelques infos pour démarrer.
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        <TextField label="Nom" value={name} onChangeText={setName} placeholder="Claire Dubois" />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="vous@exemple.fr" />
        <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="8 caractères minimum" />
        {error && (
          <Text tone="danger" size={13}>
            {error}
          </Text>
        )}
        <Button label="Créer mon compte" variant="primary" block onPress={onSubmit} loading={loading} disabled={!email || !password || !name} />
        {slow && (
          <Text tone="muted" size={13} center>
            Le serveur démarre, ça peut prendre jusqu'à une minute…
          </Text>
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
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
