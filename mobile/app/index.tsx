import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/state/authStore";
import { accountIsSetUp, useOnboardingStore } from "../src/state/onboardingStore";
import { membersApi, tasksApi } from "../src/api/resources";

// Au-delà, on montre l'accueil plutôt que de faire attendre (serveur endormi, pas de réseau).
const CHECK_TIMEOUT_MS = 10_000;

export default function Index() {
  const user = useAuthStore((s) => s.user);
  const onboarded = useOnboardingStore((s) => s.completed);
  const complete = useOnboardingStore((s) => s.complete);
  const [checked, setChecked] = useState(false);

  // Accueil pas encore vu sur ce téléphone : le compte est peut-être déjà
  // configuré (réinstallation, autre téléphone). Dans ce cas, on le saute.
  useEffect(() => {
    if (!user || onboarded) return;
    // Un compte qui a rejoint une famille (ou un enfant) n'a jamais l'accueil : inutile d'interroger le serveur.
    if (accountIsSetUp({ familyRole: user.familyRole, members: 0, tasks: 0 })) {
      complete().then(() => setChecked(true));
      return;
    }
    let cancelled = false;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), CHECK_TIMEOUT_MS));
    const lookup = Promise.all([membersApi.list(), tasksApi.list()])
      .then(([m, t]) => accountIsSetUp({ familyRole: user.familyRole, members: m.members.length, tasks: t.tasks.length }))
      .catch(() => accountIsSetUp({ familyRole: user.familyRole, members: 0, tasks: 0 }));
    Promise.race([lookup, timeout]).then(async (ready) => {
      if (cancelled) return;
      if (ready) await complete();
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user, onboarded, complete]);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (onboarded) return <Redirect href="/(tabs)/home" />;
  if (!checked) return null;
  return <Redirect href="/(onboarding)/welcome" />;
}
