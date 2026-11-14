// Passerelle theme, aligned on the logo: a deep night-blue ground (#070912,
// the logo's background), slate-blue surfaces, blue-white text, and the logo's
// neon ramp cyan → blue → violet. The 4 rings of the logo give the 4 tabs
// their colours. Spacing, radii and shadows still follow the Nocturne system.
export const color = {
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
} as const;

// The logo's neon gradient, left to right (brand colours, independent of the
// tab tints). Used for primary buttons, the + and the line under each tab header.
export const gradient = ["#22e5ff", "#3fb8ff", "#9b5cff"] as const;

// A soft neon halo, like the glow around the logo's rings (RN boxShadow).
export function glow(c: string, blur = 12) {
  return `0 0 ${blur}px ${c}`;
}

export const radius = { sm: 4, md: 8, lg: 14 } as const;

// Spacing scale, in steps of 4. `gutter` is the side margin of every screen.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const gutter = 22;

// React Native has no box-shadow; these translate the token *intent*
// (a hairline ring + ambient darkness, no flood) into elevation/shadow props
// applied via the Card component per platform.
export const shadow = {
  sm: { ring: color.neutral800 },
  md: { ring: color.neutral700, opacity: 0.55, radius: 18, y: 6 },
  lg: { ring: color.neutral500, opacity: 0.65, radius: 40, y: 16 },
} as const;

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

export const tint = {
  accent: { bg: color.accent800, fg: color.accent100 },
  neutral: { bg: color.neutral700, fg: color.neutral100 },
  accent2: { bg: color.accent800, fg: color.accent100 },
} as const;

export type TintName = keyof typeof tint;
