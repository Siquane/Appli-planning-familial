// Passerelle theme, aligned on the logo: a deep night-blue ground (#070912,
// the logo's background), slate-blue surfaces, blue-white text, and the logo's
// neon ramp cyan → blue → violet. The 4 rings of the logo give the 4 tabs
// their colours. Spacing, radii and shadows still follow the Nocturne system.
const dark = {
  bg: "#070912",
  surface: "#0f1426",
  text: "#e8f4ff",
  divider: "rgba(232,244,255,0.13)",

  accent: "#22e5ff",
  accent100: "#e6fcff",
  accent200: "#b5f5ff",
  accent300: "#7aeeff",
  accent400: "#45e8ff",
  accent500: "#22e5ff",
  accent600: "#12b4cc",
  accent700: "#0d8599",
  accent800: "#0a4f5e",
  accent900: "#062a33",

  // Neutrals lean slightly blue so greys sit naturally on the night-blue ground.
  neutral100: "#eef3ff",
  neutral200: "#dde4f5",
  neutral300: "#c3cbe2",
  neutral400: "#a3adc9",
  neutral500: "#7f8aa8",
  neutral600: "#5f6986",
  neutral700: "#434c66",
  neutral800: "#2a3249",
  neutral900: "#181e30",

  danger: "#ff5c6c",
  success: "#3ddc97",

  // The 4 rings of the Passerelle logo, left to right (cyan → violet):
  // one per tab — Planning, Repas, Budget, Famille.
  pillar1: "#22e5ff",
  pillar2: "#45a0ff",
  pillar3: "#737cff",
  pillar4: "#ad5cff",

  // Halos néon (boutons principaux, onglet actif) et voile derrière les fenêtres.
  glowSoft: "rgba(76,196,255,0.35)",
  glowStrong: "rgba(76,196,255,0.5)",
  pressed: "rgba(232,244,255,0.12)",
  scrim: "rgba(7,9,18,0.85)",
  grid: "rgba(34,229,255,0.05)",
  // Texte et icônes posés sur le dégradé (boutons principaux).
  onGradient: "#070912",
  // Couleur de note « ambre ».
  amber: "#ffb547",
  // Rebord « épais » sous les boutons, qui s'écrase quand on appuie.
  edge: "#4b2f9e",
  edgeSoft: "#1e2740",
};

export type Palette = Record<keyof typeof dark, string>;

// Thème clair « blanc et néon adouci » : fond blanc bleuté, texte bleu nuit,
// le même dégradé cyan → violet un peu plus foncé pour rester lisible. Les
// échelles accent* et neutral* sont inversées : neutral100 reste « le plus
// contrasté », neutral900 « le plus proche du fond », comme en sombre.
const light: Palette = {
  bg: "#f4f8ff",
  surface: "#ffffff",
  text: "#0b1530",
  divider: "rgba(11,21,48,0.12)",

  accent: "#07788f",
  accent100: "#05323b",
  accent200: "#08505e",
  accent300: "#0a7085",
  accent400: "#0b86a1",
  accent500: "#07788f",
  accent600: "#3cc4dc",
  accent700: "#86dfee",
  accent800: "#cdf3fa",
  accent900: "#e8fafd",

  neutral100: "#121a33",
  neutral200: "#232c47",
  neutral300: "#3a4462",
  neutral400: "#4f5978",
  neutral500: "#636d8d",
  neutral600: "#8e97b3",
  neutral700: "#c2c9dc",
  neutral800: "#dfe4f0",
  neutral900: "#eef1f8",

  danger: "#d22f45",
  success: "#13895a",

  pillar1: "#07788f",
  pillar2: "#2f7fe0",
  pillar3: "#5560e8",
  pillar4: "#8a3fe0",

  glowSoft: "rgba(63,143,240,0.28)",
  glowStrong: "rgba(63,143,240,0.35)",
  pressed: "rgba(11,21,48,0.06)",
  scrim: "rgba(11,21,48,0.45)",
  grid: "rgba(8,150,179,0.06)",
  onGradient: "#0b1530",
  amber: "#b56d00",
  edge: "#5a2fb8",
  edgeSoft: "#c2c9dc",
};

/** Palette en cours. Modifiée sur place par applyTheme : la lire au moment du rendu. */
export const color: Palette = { ...dark };

/** Couleurs fixes du thème sombre (widgets de l'écran d'accueil, qui restent sombres). */
export const darkColor: Readonly<Palette> = dark;

export type Scheme = "dark" | "light";
let currentScheme: Scheme = "dark";
export const activeScheme = () => currentScheme;

// The logo's neon gradient, left to right (brand colours, independent of the
// tab tints). Used for primary buttons, the + and the line under each tab header.
const darkGradient = ["#22e5ff", "#3fb8ff", "#9b5cff"];
const lightGradient = ["#12b8d6", "#3f8ff0", "#8a4cf0"];
export const gradient: string[] = [...darkGradient];

// A soft neon halo, like the glow around the logo's rings (RN boxShadow).
export function glow(c: string, blur = 12) {
  return `0 0 ${blur}px ${c}`;
}

// Coins arrondis, un peu ludiques (cartes 14, grands blocs 18).
export const radius = { sm: 6, md: 14, lg: 18 } as const;

// Spacing scale, in steps of 4. `gutter` is the side margin of every screen.
// `section` : écart entre les rubriques d'un formulaire (Titre, Durée, Priorité…).
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, section: 36 } as const;
export const gutter = 22;

// React Native has no box-shadow; these translate the token *intent*
// (a hairline ring + ambient darkness, no flood) into elevation/shadow props
// applied via the Card component per platform.
export const shadow = {
  sm: {
    get ring() {
      return color.neutral800;
    },
  },
  md: {
    get ring() {
      return color.neutral700;
    },
    opacity: 0.55,
    radius: 18,
    y: 6,
  },
  lg: {
    get ring() {
      return color.neutral500;
    },
    opacity: 0.65,
    radius: 40,
    y: 16,
  },
};

import { Platform } from "react-native";

export const font = {
  // Titles use Space Grotesk, the geometric type of the PASSERELLE wordmark.
  heading: "SpaceGrotesk_500Medium",
  headingSemibold: "SpaceGrotesk_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  // No bundled mono font (Passerelle just needs digits to look technical, not a
  // specific typeface) — the platform monospace covers times/durations fine.
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
} as const;

const tintOf = (bg: keyof Palette, fg: keyof Palette) => ({
  get bg() {
    return color[bg];
  },
  get fg() {
    return color[fg];
  },
});

export const tint = {
  accent: tintOf("accent800", "accent100"),
  neutral: tintOf("neutral700", "neutral100"),
  accent2: tintOf("accent800", "accent100"),
};

export type TintName = keyof typeof tint;

/**
 * Passe tout l'affichage en clair ou en sombre. Les écrans lisent `color` au
 * rendu : la racine les remonte (clé = thème) juste après l'appel.
 */
export function applyTheme(scheme: Scheme) {
  currentScheme = scheme;
  Object.assign(color, scheme === "light" ? light : dark);
  gradient.splice(0, gradient.length, ...(scheme === "light" ? lightGradient : darkGradient));
}
