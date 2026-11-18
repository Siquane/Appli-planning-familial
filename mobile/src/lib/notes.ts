import type { Note, NoteColor } from "../api/types";
import { color, type Palette } from "../theme/tokens";

/** Couleurs proposées pour une note, et la teinte de la palette qui la dessine. */
export const NOTE_COLORS: { key: NoteColor; label: string; token: keyof Palette | null }[] = [
  { key: "default", label: "Sans couleur", token: null },
  { key: "cyan", label: "Cyan", token: "pillar1" },
  { key: "blue", label: "Bleu", token: "pillar2" },
  { key: "lavender", label: "Lavande", token: "pillar3" },
  { key: "violet", label: "Violet", token: "pillar4" },
  { key: "green", label: "Vert", token: "success" },
  { key: "amber", label: "Ambre", token: "amber" },
];

/** Teinte d'une note au moment du rendu (thème clair ou sombre). */
export function noteTint(c: NoteColor): string | null {
  const token = NOTE_COLORS.find((x) => x.key === c)?.token;
  return token ? color[token] : null;
}

/** Épinglées d'abord, puis la plus récemment modifiée. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

/** Titre à afficher : le titre, sinon la première ligne du texte. */
export function noteHeading(n: Pick<Note, "title" | "body">): string {
  return n.title.trim() || n.body.trim().split("\n")[0]?.trim() || "Note";
}

/** Aperçu du texte sur une ligne (sans la ligne déjà utilisée comme titre). */
export function notePreview(n: Pick<Note, "title" | "body">, max = 120): string {
  const lines = n.body.split("\n").map((l) => l.trim()).filter(Boolean);
  const rest = n.title.trim() ? lines : lines.slice(1);
  const text = rest.join(" · ");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type NoteFilter = "all" | "family" | "mine";

export function filterNotes(notes: Note[], filter: NoteFilter): Note[] {
  if (filter === "family") return notes.filter((n) => n.shared);
  if (filter === "mine") return notes.filter((n) => !n.shared);
  return notes;
}
