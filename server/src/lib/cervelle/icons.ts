// Illustrations the app draws for a revision card. Claude picks one key.
export const REVISION_ICONS = [
  "livre", "plante", "planete", "couronne", "globe", "calcul", "fiole", "atome", "palette", "musique",
  "langue", "plume", "sablier", "corps", "ballon", "ordinateur", "carte", "balance",
] as const;
export type RevisionIcon = (typeof REVISION_ICONS)[number];

export const LEVELS = ["primaire", "college", "lycee", "superieur", "adulte"] as const;
export type Level = (typeof LEVELS)[number];
