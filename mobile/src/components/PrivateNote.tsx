import { Text } from "./Text";
import { useAuthStore } from "../state/authStore";

// For a « planning » account of a family: its budget and documents are its own,
// not shared with the family. Nothing is shown for the others.
export function PrivateNote({ what }: { what: "budget" | "documents" }) {
  const role = useAuthStore((s) => s.user?.familyRole);
  if (role !== "planning") return null;
  return (
    <Text size={13} tone="faint" center>
      {what === "budget" ? "Ton budget est personnel : il n'est pas partagé avec la famille." : "Tes documents sont personnels : ils ne sont pas partagés avec la famille."}
    </Text>
  );
}
