# Passerelle — Design system

## Product
Passerelle is a French family-planning mobile app (Android first, Expo / React Native) for parents and teenagers. One shared space for the whole family: weekly planning of tasks and appointments, meals (weekly menu, recipes, shopping list), budget (personal monthly budget + shared expenses "who owes whom"), and the family (members, children's access, stars/rewards).
Users: busy parents (main), teenagers 11–17. Copy is French, always informal « tu », simple words, warm and encouraging, never technical.

Navigation: bottom tab bar — Planning, Repas, central round « + » (gradient, opens quick-add sheet), Budget, Famille. Each screen: header with the small logo + big title (Space Grotesk), search / bell / avatar icons on Planning, and a thin neon gradient line under the header.

## Visual identity (keep exactly)
- Theme: DARK, "night neon". Background #070912 with a very faint cyan grid (rgba(34,229,255,0.05)). Cards/surfaces #0F1426 with 1px hairline borders (#1E2740 / rgba(232,244,255,0.13)). Text #E8F4FF; muted text neutral400 #A3ADC9, neutral500 #7F8AA8.
- Brand gradient (logo): cyan #22E5FF → blue #3FB8FF → violet #9B5CFF. Used ONLY for primary buttons, the central « + », the line under headers, progress rings and the active highlights. Text on gradient: #070912.
- Accent scale (cyan): 200 #B5F5FF, 300 #7AEEFF, 500 #22E5FF, 600 #12B4CC, 800 #0A4F5E (selected chips / selected day background), 900 #062A33.
- Neutrals (blue-tinted): 100 #EEF3FF, 300 #C3CBE2, 400 #A3ADC9, 500 #7F8AA8, 600 #5F6986, 700 #434C66, 800 #2A3249, 900 #181E30.
- Tab colours (the 4 rings of the logo): Planning #22E5FF, Repas #45A0FF, Budget #737CFF, Famille #AD5CFF.
- Semantic: danger #FF5C6C, success #3DDC97, amber #FFB547.
- Neon glow: soft halo rgba(76,196,255,0.35) around primary buttons and the « + ».
- Fonts: Space Grotesk 500/700 for titles and big numbers; Inter 400/500/600 for body. Times/durations may use monospace digits.
- Radii: 6 (small), 14 (cards), 18 (big blocks), pills fully rounded. Spacing steps of 4 (4, 8, 12, 16, 24, 36); screen side margin 22px.
- Logo: arch with 4 dots in the cyan→violet gradient + wordmark « PASSERELLE » in caps. Use the supplied logo asset only.
- Icons: thin line icons (1.75 stroke), rounded caps, like Lucide.

## Components
- Chips: pill, 1px border neutral800; selected = bg accent800 #0A4F5E, text accent100.
- Week strip: 7 rounded day tiles (Lun…Dim + date), selected day filled accent800 with a dot.
- Task card: surface card, time on the left, title, category tag, member avatars (round initials with tint), checkbox or star reward; École/Travail tasks show an icon instead of a checkbox.
- Today card « Aujourd'hui »: summary lines with small coloured icons (tasks, tonight's dinner, budget alerts).
- Progress card: gradient ring « 2/6 » + encouraging line.
- Buttons: primary = gradient fill with dark text and glow and a slightly thicker violet bottom edge (#4B2F9E); secondary = outline; ghost = text only.

## Motion
Gentle: fade/slide-in of cards, press = slight squash. Always respect reduced motion.

## Constraints
Mobile portrait 390×844. Dark only. Never add new fonts or colours. French texts with « tu ».
