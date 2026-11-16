# Programmes officiels (sources de Cervelle)

Textes officiels de l'Éducation nationale fournis par la famille (les sites
du ministère bloquent les serveurs). Ils servent à vérifier et compléter la
liste des chapitres de `server/src/lib/cervelle/programme.ts`.
`texte/` contient le texte extrait de chaque PDF (pdftotext -layout).

| Fichier | Texte |
|---|---|
| emc-cp-terminale-2024.pdf | Programme d'EMC du CP à la terminale (BO n° 24 du 13 juin 2024) |
| francais-cycle4-2026.pdf | Programme de français du cycle 4 (BO n° 10 du 5 mars 2026) |
| technologie-cycle4.pdf | Programme de technologie du cycle 4 (BO n° 9 du 29 février 2024) |
| mathematiques-cycle4-2026.pdf | Programme de mathématiques du cycle 4 (BO n° 10 du 5 mars 2026), avec des repères par année (5e, 4e, 3e) |
| anglais-college.pdf | Programme d'anglais pour les classes de collège (2025) |
| italien-college.pdf | Programme d'italien pour les classes de collège (2025) |
| francais-cycle3-2025.pdf | Programme de français du cycle 3 (BO n° 16 du 17 avril 2025) |
| mathematiques-cycle3-2025.pdf | Programme de mathématiques du cycle 3 (BO n° 16 du 17 avril 2025) |
| evar-elementaire-2025.pdf | Éducation à la vie affective et relationnelle, école élémentaire (BO n° 6 du 6 février 2025) |
| evars-college-2025.pdf | Éducation à la vie affective et relationnelle, et à la sexualité, collège (BO n° 6 du 6 février 2025) |
| cycle3-2023-partie1.pdf, cycle3-2023-partie2.pdf | Programme du cycle 3 en vigueur à la rentrée 2023 (BO n° 31 du 30 juillet 2020 et BO n° 25 du 22 juin 2023) : histoire-géographie, sciences et technologie… (texte réuni : texte/cycle3-2023.txt) |
| cycle4-2020-partie1.pdf, cycle4-2020-partie2.pdf | Programme du cycle 4 (BO n° 31 du 30 juillet 2020) : histoire-géographie, SVT, physique-chimie… (texte réuni : texte/cycle4-2020.txt) |
| texte/eduscol-enseigner-cycle3.txt, texte/eduscol-enseigner-cycle4.txt | Pages Éduscol « Enseigner au cycle 3 / 4 » (16/11/2026) : programmes en vigueur par classe en 2026-2027 |

## Programmes en vigueur en 2026-2027 (d'après Éduscol)

| Matière | CM2 | 6e | 5e | 4e | 3e |
|---|---|---|---|---|---|
| Français | BO n° 16 du 17 avril 2025 (nouveau) | BO n° 16 du 17 avril 2025 | BO n° 10 du 5 mars 2026 (nouveau) | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |
| Mathématiques | BO n° 16 du 17 avril 2025 (nouveau) | BO n° 16 du 17 avril 2025 | BO n° 10 du 5 mars 2026 (nouveau) | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |
| Histoire-géographie | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |
| Sciences et technologie | BO n° 25 du 22 juin 2023 | BO n° 25 du 22 juin 2023 | — | — | — |
| SVT, physique-chimie | — | — | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |
| Technologie | — | — | BO n° 9 du 29 février 2024 | BO n° 9 du 29 février 2024 | BO n° 9 du 29 février 2024 (nouveau) |
| EMC | BO n° 24 du 13 juin 2024 | BO n° 24 du 13 juin 2024 (nouveau) | BO n° 24 du 13 juin 2024 | BO n° 24 du 13 juin 2024 | BO n° 24 du 13 juin 2024 (nouveau) |
| Langues vivantes | BO n° 31 du 30 juillet 2020 | BO n° 22 du 29 mai 2025 | BO n° 22 du 29 mai 2025 (nouveau) | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |
| Vie affective | BO n° 6 du 6 février 2025 (élémentaire) | BO n° 6 du 6 février 2025 (collège) | idem | idem | idem |
| Arts, musique, EPS | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 | BO n° 31 du 30 juillet 2020 |

Remarques pour `programme.ts` :
- Les maths et le français 2020 (4e, 3e), les SVT, la physique-chimie et les
  langues vivantes 2020 n'ont pas de découpage par année : chapitres marqués
  `cycleWide` (ordre choisi par le professeur). La technologie 2024 a des
  repères par année, repris tels quels.
- Pas d'italien en 6e (la LV2 commence en 5e).
