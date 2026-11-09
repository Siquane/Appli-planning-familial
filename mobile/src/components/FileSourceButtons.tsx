import { View } from "react-native";
import { Chip } from "./Chip";
import { pickFile, UploadError, type PickedFile, type PickSource } from "../lib/documentUpload";
import { useToastStore } from "../state/toastStore";
import { space } from "../theme/tokens";

const SOURCES: { source: PickSource; label: string }[] = [
  { source: "camera", label: "Prendre une photo" },
  { source: "photos", label: "Galerie" },
  { source: "files", label: "PDF / fichier" },
];

// Three inline choices rather than an Alert: Android alerts cap out at three
// buttons, which leaves no room for "Annuler".
export function FileSourceButtons({ onPicked, disabled }: { onPicked: (file: PickedFile) => void; disabled?: boolean }) {
  async function choose(source: PickSource) {
    if (disabled) return;
    try {
      const file = await pickFile(source);
      if (file) onPicked(file);
    } catch (e) {
      useToastStore.getState().show(e instanceof UploadError ? e.message : "Impossible d'ouvrir le sélecteur de fichiers.");
    }
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], opacity: disabled ? 0.5 : 1 }}>
      {SOURCES.map((s) => (
        <Chip key={s.source} label={s.label} size="sm" onPress={() => choose(s.source)} />
      ))}
    </View>
  );
}
