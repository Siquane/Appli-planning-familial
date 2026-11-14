import { useState } from "react";
import { View } from "react-native";
import { router, Link, useLocalSearchParams } from "expo-router";
import { Screen } from "../../src/components/Screen";
import { Text } from "../../src/components/Text";
import { TextField } from "../../src/components/TextField";
import { Button } from "../../src/components/Button";
import { useAuthStore } from "../../src/state/authStore";
import { useSlowHint } from "../../src/hooks/useSlowHint";
import { space } from "../../src/theme/tokens";
import { errorText } from "../../src/lib/errors";

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const slow = useSlowHint(loading);

  async function run(action: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await action();
    } catch (e) {
      setError(errorText(e, "envoyer la demande"));
    } finally {
      setLoading(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await requestPasswordReset(email.trim());
      setStep("code");
      setInfo(`Si un compte existe pour ${email.trim()}, un code à 6 chiffres vient d'y être envoyé. Pense à regarder dans les spams.`);
    });

  const submitReset = () =>
    run(async () => {
      await resetPassword(email.trim(), code.trim(), password);
      router.replace("/");
    });

  return (
    <Screen keyboard style={{ justifyContent: "center", gap: space[6] }}>
      <View style={{ gap: 4 }}>
        <Text heading weight="semibold" size={28}>
          Mot de passe oublié
        </Text>
        <Text tone="muted" size={15}>
          {step === "email" ? "Indique ton e-mail, on t'envoie un code." : info}
        </Text>
      </View>

      <View style={{ gap: space[3] }}>
        {step === "email" ? (
          <TextField label="Adresse e-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="toi@exemple.fr" />
        ) : (
          <>
            <TextField
              label="Code reçu par e-mail"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
            />
            <TextField label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry placeholder="8 caractères minimum" />
          </>
        )}
        {error && (
          <Text tone="danger" size={13}>
            {error}
          </Text>
        )}
        {step === "email" ? (
          <Button label="Recevoir un code" variant="primary" block onPress={sendCode} loading={loading} disabled={!email.trim()} />
        ) : (
          <Button
            label="Changer mon mot de passe"
            variant="primary"
            block
            onPress={submitReset}
            loading={loading}
            disabled={code.length !== 6 || password.length < 8}
          />
        )}
        {slow && (
          <Text tone="muted" size={13} center>
            Le serveur démarre, ça peut prendre jusqu'à une minute…
          </Text>
        )}
        {step === "code" && (
          <Button label="Renvoyer un code" variant="ghost" block onPress={sendCode} disabled={loading} />
        )}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center" }}>
        <Link href="/(auth)/login">
          <Text tone="accent" size={13} weight="medium">
            Retour à la connexion
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
